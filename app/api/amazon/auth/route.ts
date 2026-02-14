import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appId = process.env.AMAZON_SP_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "Amazon SP App ID not configured" }, { status: 500 })
  }

  // Determine the base URL dynamically
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3000"

  // Amazon Seller Central OAuth consent URL
  // https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow
  const authUrl = new URL("https://sellercentral.amazon.com/apps/authorize/consent")
  authUrl.searchParams.set("application_id", appId)
  authUrl.searchParams.set("state", user.id)
  authUrl.searchParams.set("redirect_uri", `${baseUrl}/api/amazon/callback`)
  // version=beta is required for draft/private apps
  authUrl.searchParams.set("version", "beta")

  return NextResponse.redirect(authUrl.toString())
}
