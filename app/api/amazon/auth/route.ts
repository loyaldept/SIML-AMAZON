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

  // Build the Amazon Seller Central OAuth consent URL
  // Docs: https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow
  const authUrl = new URL("https://sellercentral.amazon.com/apps/authorize/consent")
  authUrl.searchParams.set("application_id", appId)
  authUrl.searchParams.set("state", user.id)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("version", "beta")

  return NextResponse.redirect(authUrl.toString())
}
