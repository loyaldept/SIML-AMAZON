import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAmazonToken,
  getSellerInfo,
  getOrders,
  getFbaInventory,
  getFinancialEventGroups,
} from "@/lib/amazon-sp-api"

export const maxDuration = 30

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
    return NextResponse.json({ connected: false, error: "Could not get access token - may need to reconnect" })
  }

  const marketplaceId = conn.marketplace_id || "ATVPDKIKX0DER" // default US
  const marketplaceIds = [marketplaceId]
  const result: any = {
    connected: true,
    seller_id: conn.seller_id,
    store_name: conn.store_name,
    marketplace_id: marketplaceId,
    errors: [],
  }

  // Run all SP-API calls in parallel for speed
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [sellerResult, ordersResult, inventoryResult, financesResult] = await Promise.allSettled([
    getSellerInfo(accessToken),
    getOrders(accessToken, marketplaceIds, thirtyDaysAgo),
    getFbaInventory(accessToken, marketplaceIds),
    getFinancialEventGroups(accessToken),
  ])

  // 1. Seller participations
  if (sellerResult.status === "fulfilled") {
    result.participations = sellerResult.value?.payload || []
  } else {
    result.errors.push(`Seller info: ${sellerResult.reason?.message}`)
    result.participations = []
  }

  // 2. Orders
  if (ordersResult.status === "fulfilled") {
    const orders = ordersResult.value?.payload?.Orders || []
    result.orders = orders.slice(0, 50)
    result.order_count = orders.length

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

    // Sync orders to Supabase in background (don't await each one)
    const upsertPromises = orders.slice(0, 50).map((order: any) =>
      supabase.from("orders").upsert({
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
    )
    await Promise.allSettled(upsertPromises)
  } else {
    result.errors.push(`Orders: ${ordersResult.reason?.message}`)
    result.orders = []
    result.order_count = 0
    result.total_revenue = 0
    result.shipped_orders = 0
    result.pending_orders = 0
  }

  // 3. FBA Inventory
  if (inventoryResult.status === "fulfilled") {
    const payload = inventoryResult.value?.payload || inventoryResult.value || {}
    const summaries = payload.inventorySummaries || []
    result.fba_inventory = summaries.slice(0, 100)
    result.fba_total_units = summaries.reduce((sum: number, s: any) =>
      sum + (s.totalQuantity || 0), 0)
    result.fba_total_skus = summaries.length
  } else {
    result.errors.push(`FBA Inventory: ${inventoryResult.reason?.message}`)
    result.fba_inventory = []
    result.fba_total_units = 0
    result.fba_total_skus = 0
  }

  // 4. Financial event groups
  if (financesResult.status === "fulfilled") {
    result.financial_groups = financesResult.value?.payload?.FinancialEventGroupList || []
  } else {
    result.errors.push(`Finances: ${financesResult.reason?.message}`)
    result.financial_groups = []
  }

  return NextResponse.json(result)
}
