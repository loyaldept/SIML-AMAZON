import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientId = process.env.AMAZON_SP_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Amazon SP-API not configured" }, { status: 500 })
  }

  // Build the Amazon Seller Central authorization URL
  // Determine the base URL from environment or Vercel deployment
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
    || "http://localhost:3000"

  const params = new URLSearchParams({
    application_id: clientId,
    state: user.id,
    redirect_uri: `${baseUrl}/api/amazon/callback`,
  })

  const authUrl = `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
