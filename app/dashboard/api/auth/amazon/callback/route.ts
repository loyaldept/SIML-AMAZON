import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { exchangeCodeForTokens, getSellerInfo } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  // Determine the public-facing base URL for redirects
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    new URL(request.url).origin

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("spapi_oauth_code")
  const state = searchParams.get("state") // This is the user.id we sent
  const sellingPartnerId = searchParams.get("selling_partner_id")

  console.log("[v0] Amazon callback received - code:", !!code, "state:", state, "selling_partner_id:", sellingPartnerId)

  if (!code) {
    console.log("[v0] Missing spapi_oauth_code param - all params:", Object.fromEntries(searchParams.entries()))
    return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)
  }

  if (!state) {
    console.log("[v0] Missing state param")
    return NextResponse.redirect(`${baseUrl}/settings?error=missing_state`)
  }

  try {
    // Try to get the authenticated user from the session cookie
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Use the state (user_id) to identify the user even if session cookie is lost
    const userId = user?.id || state

    // Verify: if we have a session, the user ID must match the state
    if (user && user.id !== state) {
      console.log("[v0] Auth mismatch - session user:", user.id, "state:", state)
      return NextResponse.redirect(`${baseUrl}/settings?error=auth_mismatch`)
    }

    console.log("[v0] Exchanging authorization code for tokens...")

    // Step 1: Exchange the authorization code for LWA access + refresh tokens
    const tokens = await exchangeCodeForTokens(code)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    console.log("[v0] Token exchange successful. Fetching seller info...")

    // Step 2: Get seller info and marketplace participations
    let sellerId = sellingPartnerId || ""
    let marketplaceId = "ATVPDKIKX0DER" // Default US marketplace
    let storeName = `Amazon Seller`
    let marketplaces: any[] = []

    try {
      const sellerData = await getSellerInfo(tokens.access_token)
      console.log("[v0] Seller info response:", JSON.stringify(sellerData).slice(0, 500))

      if (sellerData?.payload && Array.isArray(sellerData.payload)) {
        marketplaces = sellerData.payload
        // Find the US marketplace participation, or use the first one
        const usParticipation = sellerData.payload.find(
          (p: any) => p.marketplace?.id === "ATVPDKIKX0DER"
        ) || sellerData.payload[0]

        if (usParticipation) {
          sellerId = usParticipation.seller?.sellerId || sellerId
          marketplaceId = usParticipation.marketplace?.id || marketplaceId
          const countryCode = usParticipation.marketplace?.countryCode || "US"
          storeName = `Amazon ${countryCode} (${sellerId})`
        }
      }
    } catch (sellerError: any) {
      console.log("[v0] Non-fatal: getSellerInfo error:", sellerError.message)
      // Continue - we still have valid tokens
    }

    console.log("[v0] Saving connection - sellerId:", sellerId, "marketplaceId:", marketplaceId)

    // Step 3: Store the connection in the database
    const { error: upsertError } = await supabase.from("channel_connections").upsert(
      {
        user_id: userId,
        channel: "Amazon",
        connected: true,
        status: "connected",
        store_name: storeName,
        seller_id: sellerId,
        marketplace_id: marketplaceId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        credentials: {
          selling_partner_id: sellingPartnerId,
          marketplace_participations: marketplaces.map((m: any) => ({
            marketplace_id: m.marketplace?.id,
            country: m.marketplace?.countryCode,
            seller_id: m.seller?.sellerId,
          })),
          connected_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,channel" }
    )

    if (upsertError) {
      console.log("[v0] Supabase upsert error:", upsertError)
      return NextResponse.redirect(`${baseUrl}/settings?error=db_save_failed`)
    }

    // Step 4: Create a success notification
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "system",
      title: "Amazon Connected",
      message: `Your Amazon Seller account (${sellerId || sellingPartnerId || "unknown"}) has been successfully connected with ${marketplaces.length || 1} marketplace(s).`,
    })

    console.log("[v0] Amazon connection saved successfully! Redirecting to dashboard...")

    // Step 5: Redirect to dashboard with success indicator
    return NextResponse.redirect(`${baseUrl}/dashboard?amazon=connected`)
  } catch (error: any) {
    console.error("[v0] Amazon callback error:", error.message, error.stack)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent(error.message || "connection_failed")}`
    )
  }
}
