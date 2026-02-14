import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getFbaInventory } from "@/lib/amazon-sp-api"

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
    const inventory = await getFbaInventory(token, [marketplaceId])

    // Sync FBA inventory to our inventory table
    if (inventory?.payload?.inventorySummaries) {
      for (const item of inventory.payload.inventorySummaries) {
        await supabase.from("inventory").upsert({
          user_id: user.id,
          asin: item.asin,
          sku: item.sellerSku,
          title: item.productName || item.sellerSku,
          quantity: item.inventoryDetails?.fulfillableQuantity || 0,
          channel: "FBA",
          status: (item.inventoryDetails?.fulfillableQuantity || 0) > 0 ? "active" : "out_of_stock",
        }, { onConflict: "user_id,asin" })
      }
    }

    return NextResponse.json(inventory)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
