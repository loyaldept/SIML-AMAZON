import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getCompetitivePricing, getItemOffers } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const asin = searchParams.get("asin")
  const type = searchParams.get("type") || "competitive" // competitive | offers

  if (!asin) return NextResponse.json({ error: "ASIN required" }, { status: 400 })

  try {
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"

    if (type === "offers") {
      const offers = await getItemOffers(token, asin, marketplaceId)
      return NextResponse.json(offers)
    }

    const pricing = await getCompetitivePricing(token, asin, marketplaceId)
    return NextResponse.json(pricing)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
