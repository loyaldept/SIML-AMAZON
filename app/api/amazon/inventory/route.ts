import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getAllFbaInventory } from "@/lib/amazon-sp-api"

export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  try {
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"
    const summaries = await getAllFbaInventory(token, [marketplaceId])

    // Sync FBA inventory to our inventory table
    for (const item of summaries) {
      const qty = item.inventoryDetails?.fulfillableQuantity || item.totalQuantity || 0
      await supabase.from("inventory").upsert({
        user_id: user.id,
        asin: item.asin,
        sku: item.sellerSku,
        title: item.productName || item.sellerSku || item.asin,
        quantity: qty,
        channel: "FBA",
        status: qty > 0 ? "active" : "out_of_stock",
        fulfillment_channel: item.inventoryDetails ? "FBA" : "FBM",
        fnsku: item.fnSku || null,
      }, { onConflict: "user_id,asin" })
    }

    return NextResponse.json({
      inventorySummaries: summaries,
      totalSkus: summaries.length,
      totalUnits: summaries.reduce((sum: number, s: any) =>
        sum + (s.inventoryDetails?.fulfillableQuantity || s.totalQuantity || 0), 0),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
