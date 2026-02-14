import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Debug endpoint to check Amazon OAuth configuration
// Visit /api/amazon/debug to see the exact values being used
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const appId = process.env.AMAZON_SP_APP_ID
  const redirectUri = process.env.AMAZON_REDIRECT_URI
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const vercelUrl = process.env.VERCEL_URL
  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL

  // Build the exact URL that would be sent to Amazon
  const authUrl = new URL("https://sellercentral.amazon.com/apps/authorize/consent")
  authUrl.searchParams.set("application_id", appId || "NOT_SET")
  authUrl.searchParams.set("state", user?.id || "no-user")
  authUrl.searchParams.set("version", "beta")

  return NextResponse.json({
    user_id: user?.id || null,
    env_vars: {
      AMAZON_SP_APP_ID: appId ? `${appId.slice(0, 20)}...` : "NOT SET",
      AMAZON_REDIRECT_URI: redirectUri || "NOT SET",
      NEXT_PUBLIC_SITE_URL: siteUrl || "NOT SET",
      VERCEL_URL: vercelUrl || "NOT SET",
      VERCEL_PROJECT_PRODUCTION_URL: vercelProdUrl || "NOT SET",
    },
    oauth_url_that_would_be_sent: authUrl.toString(),
    note: "redirect_uri is NOT included in the URL - Amazon uses the one registered in Developer Console for draft apps",
  })
}
