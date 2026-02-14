import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { exchangeCodeForTokens, getSellerInfo } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("spapi_oauth_code")
  const state = searchParams.get("state")
  const sellingPartnerId = searchParams.get("selling_partner_id")

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=missing_params", request.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.id !== state) {
      return NextResponse.redirect(new URL("/settings?error=auth_mismatch", request.url))
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Get seller info to find marketplace IDs
    let sellerId = sellingPartnerId || ""
    let marketplaceId = "ATVPDKIKX0DER" // Default to US marketplace
    try {
      const sellerData = await getSellerInfo(tokens.access_token)
      if (sellerData?.payload?.[0]) {
        const participation = sellerData.payload[0]
        sellerId = participation.seller?.sellerId || sellerId
        marketplaceId = participation.marketplace?.id || marketplaceId
      }
    } catch {
      // Non-fatal, continue with defaults
    }

    // Store the connection in the database
    await supabase.from("channel_connections").upsert(
      {
        user_id: user.id,
        channel: "Amazon",
        connected: true,
        status: "connected",
        store_name: `Amazon Seller (${sellingPartnerId || "connected"})`,
        seller_id: sellerId,
        marketplace_id: marketplaceId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        credentials: {
          selling_partner_id: sellingPartnerId,
          connected_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,channel" }
    )

    // Create a notification about successful connection
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "system",
      title: "Amazon Connected",
      message: `Your Amazon Seller account (${sellerId || "unknown"}) has been successfully connected.`,
    })

    return NextResponse.redirect(new URL("/settings?amazon=connected", request.url))
  } catch (error: any) {
    console.error("Amazon callback error:", error)
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error.message || "connection_failed")}`, request.url))
  }
}
