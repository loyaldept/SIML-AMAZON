import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getOrders, getOrderItems } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get("orderId")
  const daysBack = searchParams.get("days") || "30"

  try {
    // Get marketplace ID from connection
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"

    if (orderId) {
      const items = await getOrderItems(token, orderId)
      return NextResponse.json(items)
    }

    const createdAfter = new Date(Date.now() - parseInt(daysBack) * 24 * 60 * 60 * 1000).toISOString()
    const orders = await getOrders(token, [marketplaceId], createdAfter)

    // Sync orders to Supabase
    if (orders?.payload?.Orders) {
      for (const order of orders.payload.Orders.slice(0, 50)) {
        await supabase.from("orders").upsert({
          user_id: user.id,
          amazon_order_id: order.AmazonOrderId,
          status: order.OrderStatus,
          total_amount: order.OrderTotal?.Amount ? parseFloat(order.OrderTotal.Amount) : 0,
          currency: order.OrderTotal?.CurrencyCode || "USD",
          items_count: order.NumberOfItemsUnshipped + order.NumberOfItemsShipped,
          buyer_email: order.BuyerInfo?.BuyerEmail || null,
          order_date: order.PurchaseDate,
          channel: "Amazon",
          raw_data: order,
        }, { onConflict: "user_id,amazon_order_id" })
      }
    }

    return NextResponse.json(orders)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
