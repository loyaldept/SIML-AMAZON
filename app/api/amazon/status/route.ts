import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getSellerInfo } from "@/lib/amazon-sp-api"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: conn } = await supabase
    .from("channel_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("channel", "Amazon")
    .single()

  if ((!conn?.connected && conn?.status !== "connected") || !conn?.refresh_token) {
    return NextResponse.json({ connected: false })
  }

  try {
    const token = await getAmazonToken(user.id)
    if (!token) return NextResponse.json({ connected: false })

    const sellerInfo = await getSellerInfo(token)
    return NextResponse.json({
      connected: true,
      sellerId: conn.seller_id,
      marketplaceId: conn.marketplace_id,
      participations: sellerInfo?.payload || [],
    })
  } catch {
    return NextResponse.json({ connected: true, sellerId: conn.seller_id, error: "Could not verify" })
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await supabase
    .from("channel_connections")
    .update({
      connected: false,
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    })
    .eq("user_id", user.id)
    .eq("channel", "Amazon")

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "system",
    title: "Amazon Disconnected",
    message: "Your Amazon Seller account has been disconnected.",
  })

  return NextResponse.json({ disconnected: true })
}
