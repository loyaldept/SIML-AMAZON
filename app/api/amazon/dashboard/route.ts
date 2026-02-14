import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAmazonToken,
  getSellerInfo,
  getOrders,
  getFbaInventory,
  getFinancialEventGroups,
} from "@/lib/amazon-sp-api"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check if Amazon is connected
  const { data: conn } = await supabase
    .from("channel_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("channel", "Amazon")
    .single()

  if (!conn || conn.status !== "connected") {
    return NextResponse.json({ connected: false })
  }

  // Get a valid access token (auto-refreshes if expired)
  const accessToken = await getAmazonToken(user.id)
  if (!accessToken) {
    return NextResponse.json({ connected: false, error: "Token expired" })
  }

  const marketplaceId = conn.marketplace_id || "ATVPDKIKX0DER"
  const marketplaceIds = [marketplaceId]
  const result: any = {
    connected: true,
    seller_id: conn.seller_id,
    store_name: conn.store_name,
    marketplace_id: marketplaceId,
  }

  // 1. Seller info / marketplace participations
  try {
    const sellerData = await getSellerInfo(accessToken)
    result.participations = sellerData?.payload || []
  } catch (e: any) {
    result.participations_error = e.message
  }

  // 2. Orders (last 30 days)
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const ordersData = await getOrders(accessToken, marketplaceIds, thirtyDaysAgo)
    const orders = ordersData?.payload?.Orders || []
    result.orders = orders.slice(0, 50)
    result.order_count = orders.length

    // Calculate revenue from orders
    let totalRevenue = 0
    let shippedCount = 0
    let pendingCount = 0
    for (const order of orders) {
      if (order.OrderTotal?.Amount) {
        totalRevenue += parseFloat(order.OrderTotal.Amount)
      }
      if (order.OrderStatus === "Shipped") shippedCount++
      if (order.OrderStatus === "Unshipped" || order.OrderStatus === "PartiallyShipped") pendingCount++
    }
    result.total_revenue = totalRevenue
    result.shipped_orders = shippedCount
    result.pending_orders = pendingCount

    // Sync orders to Supabase
    for (const order of orders.slice(0, 50)) {
      await supabase.from("orders").upsert({
        user_id: user.id,
        amazon_order_id: order.AmazonOrderId,
        status: order.OrderStatus,
        total_amount: order.OrderTotal?.Amount ? parseFloat(order.OrderTotal.Amount) : 0,
        currency: order.OrderTotal?.CurrencyCode || "USD",
        items_count: (order.NumberOfItemsUnshipped || 0) + (order.NumberOfItemsShipped || 0),
        buyer_email: order.BuyerInfo?.BuyerEmail || null,
        order_date: order.PurchaseDate,
        channel: "Amazon",
        raw_data: order,
      }, { onConflict: "user_id,amazon_order_id" })
    }
  } catch (e: any) {
    result.orders_error = e.message
    result.orders = []
  }

  // 3. FBA Inventory
  try {
    const invData = await getFbaInventory(accessToken, marketplaceIds)
    const summaries = invData?.payload?.inventorySummaries || []
    result.fba_inventory = summaries.slice(0, 100)
    result.fba_total_units = summaries.reduce((sum: number, s: any) =>
      sum + (s.totalQuantity || 0), 0)
    result.fba_total_skus = summaries.length
  } catch (e: any) {
    result.fba_inventory_error = e.message
    result.fba_inventory = []
  }

  // 4. Financial event groups (last 90 days)
  try {
    const finData = await getFinancialEventGroups(accessToken)
    result.financial_groups = finData?.payload?.FinancialEventGroupList || []
  } catch (e: any) {
    result.financial_error = e.message
    result.financial_groups = []
  }

  return NextResponse.json(result)
}
