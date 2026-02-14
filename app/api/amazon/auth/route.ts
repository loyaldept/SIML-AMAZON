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

  // The redirect_uri MUST exactly match what is registered in the Amazon Developer Console.
  // Use AMAZON_REDIRECT_URI env var, or fall back to constructed URL.
  // Amazon registered path is /api/auth/amazon/callback (with /auth/)
  const redirectUri =
    process.env.AMAZON_REDIRECT_URI || `${baseUrl}/api/auth/amazon/callback`

  // Build the Amazon Seller Central OAuth consent URL
  // Docs: https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow
  const authUrl = new URL("https://sellercentral.amazon.com/apps/authorize/consent")
  authUrl.searchParams.set("application_id", appId)
  authUrl.searchParams.set("state", user.id)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  // version=beta is required for draft/unlisted apps
  authUrl.searchParams.set("version", "beta")

  console.log("[v0] Amazon OAuth redirect URL:", authUrl.toString())
  console.log("[v0] redirect_uri sent:", redirectUri)

  return NextResponse.redirect(authUrl.toString())
}
