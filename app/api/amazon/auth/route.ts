import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get the actual URL this request came from (works correctly in production & preview)
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", origin))
  }

  const appId = process.env.AMAZON_SP_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "Amazon SP App ID not configured" }, { status: 500 })
  }

  // Use AMAZON_REDIRECT_URI env var if set (must exactly match Amazon Developer Console),
  // otherwise fall back to the request's own origin
  const redirectUri = process.env.AMAZON_REDIRECT_URI || `${origin}/api/amazon/callback`

  // Amazon Seller Central OAuth consent URL
  // https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow
  const authUrl = new URL("https://sellercentral.amazon.com/apps/authorize/consent")
  authUrl.searchParams.set("application_id", appId)
  authUrl.searchParams.set("state", user.id)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  // version=beta is required for draft/private apps
  authUrl.searchParams.set("version", "beta")

  return NextResponse.redirect(authUrl.toString())
}
