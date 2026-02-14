import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Determine the public-facing base URL (never use request.url which may be internal on Vercel)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    new URL(request.url).origin

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/auth/login`)
  }

  const appId = process.env.AMAZON_SP_APP_ID
  if (!appId) {
    return NextResponse.redirect(`${baseUrl}/settings?error=app_id_not_configured`)
  }

  // HARDCODED to exactly match Amazon Developer Console registration
  const redirectUri = "https://app.trysiml.com/dashboard/api/auth/amazon/callback"

  // Build the URL manually to avoid double-encoding of redirect_uri
  // Amazon SP-API OAuth expects redirect_uri to be encoded exactly once
  const params = new URLSearchParams()
  params.set("application_id", appId)
  params.set("state", user.id)
  params.set("version", "beta")
  
  // Construct final URL with redirect_uri encoded exactly once using encodeURIComponent
  const authUrl = `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}&redirect_uri=${encodeURIComponent(redirectUri)}`

  console.log("[v0] Final Amazon OAuth URL:", authUrl)

  return NextResponse.redirect(authUrl)
}
