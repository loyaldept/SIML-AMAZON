import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAmazonToken,
  getSellerInfo,
  getOrders,
  getAllFbaInventory,
  getOrderMetrics,
} from "@/lib/amazon-sp-api"

export const maxDuration = 45

export async function GET(request: Request) {
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

  const accessToken = await getAmazonToken(user.id)
  if (!accessToken) {
    return NextResponse.json({ connected: false, error: "Could not get access token - may need to reconnect" })
  }

  const marketplaceId = conn.marketplace_id || "ATVPDKIKX0DER"
  const marketplaceIds = [marketplaceId]
  const result: any = {
    connected: true,
    seller_id: conn.seller_id,
    store_name: conn.store_name,
    marketplace_id: marketplaceId,
    errors: [],
  }

  // Time periods for fetching
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Build Sales API interval for last 90 days (covers 7d, 30d, and 90d views)
  const salesInterval = `${ninetyDaysAgo}--${now.toISOString()}`

  // Run all SP-API calls in parallel
  const [sellerResult, ordersResult, inventoryResult, salesResult] = await Promise.allSettled([
    getSellerInfo(accessToken),
    getOrders(accessToken, marketplaceIds, ninetyDaysAgo),
    getAllFbaInventory(accessToken, marketplaceIds),
    getOrderMetrics(accessToken, marketplaceIds, salesInterval, "Day").catch(() => null),
  ])

  // 1. Seller participations
  if (sellerResult.status === "fulfilled") {
    result.participations = sellerResult.value?.payload || []
  } else {
    result.errors.push(`Seller info: ${sellerResult.reason?.message}`)
    result.participations = []
  }

  // 2. Orders - parse all statuses
  if (ordersResult.status === "fulfilled") {
    const ordersPayload = ordersResult.value?.payload || ordersResult.value || {}
    const orders = ordersPayload?.Orders || ordersPayload?.orders || []
    result.orders = orders
    result.order_count = orders.length

    let totalRevenue = 0
    let shippedCount = 0
    let pendingCount = 0
    let canceledCount = 0
    for (const order of orders) {
      const amount = parseFloat(order.OrderTotal?.Amount || "0")
      if (amount > 0) totalRevenue += amount
      if (order.OrderStatus === "Shipped") shippedCount++
      if (order.OrderStatus === "Unshipped" || order.OrderStatus === "PartiallyShipped") pendingCount++
      if (order.OrderStatus === "Canceled") canceledCount++
    }
    result.total_revenue = totalRevenue
    result.shipped_orders = shippedCount
    result.pending_orders = pendingCount
    result.canceled_orders = canceledCount

    // Sync ALL orders to Supabase (not just 50)
    const upsertPromises = orders.map((order: any) =>
      supabase.from("orders").upsert({
        user_id: user.id,
        amazon_order_id: order.AmazonOrderId,
        status: order.OrderStatus,
        total_amount: parseFloat(order.OrderTotal?.Amount || "0"),
        currency: order.OrderTotal?.CurrencyCode || "USD",
        items_count: (order.NumberOfItemsUnshipped || 0) + (order.NumberOfItemsShipped || 0),
        buyer_email: order.BuyerInfo?.BuyerEmail || null,
        order_date: order.PurchaseDate,
        purchase_date: order.PurchaseDate,
        channel: "Amazon",
        raw_data: order,
      }, { onConflict: "user_id,amazon_order_id" })
    )
    await Promise.allSettled(upsertPromises)

    // After sync, read back from Supabase (normalized format)
    const { data: dbOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("order_date", { ascending: false })
    if (dbOrders) {
      result.db_orders = dbOrders
    }
  } else {
    result.errors.push(`Orders: ${ordersResult.reason?.message}`)
    result.orders = []
    result.order_count = 0
    result.total_revenue = 0
    result.shipped_orders = 0
    result.pending_orders = 0
  }

  // 3. FBA Inventory (all pages)
  if (inventoryResult.status === "fulfilled") {
    const summaries = inventoryResult.value || []
    result.fba_inventory = summaries
    result.fba_total_units = summaries.reduce((sum: number, s: any) => {
      const qty = s.inventoryDetails?.fulfillableQuantity
        || s.totalQuantity
        || s.inventoryDetails?.totalQuantity
        || 0
      return sum + qty
    }, 0)
    result.fba_total_skus = summaries.length

    // Sync FBA inventory to Supabase inventory table
    const invUpserts = summaries.map((item: any) =>
      supabase.from("inventory").upsert({
        user_id: user.id,
        asin: item.asin,
        sku: item.sellerSku,
        title: item.productName || item.sellerSku || item.asin,
        quantity: item.inventoryDetails?.fulfillableQuantity || item.totalQuantity || 0,
        channel: "FBA",
        status: (item.inventoryDetails?.fulfillableQuantity || item.totalQuantity || 0) > 0 ? "active" : "out_of_stock",
        fulfillment_channel: item.inventoryDetails ? "FBA" : "FBM",
        fnsku: item.fnSku || null,
      }, { onConflict: "user_id,asin" })
    )
    await Promise.allSettled(invUpserts)
  } else {
    result.errors.push(`FBA Inventory: ${inventoryResult.reason?.message}`)
    result.fba_inventory = []
    result.fba_total_units = 0
    result.fba_total_skus = 0
  }

  // 4. Sales metrics (daily breakdown for charts)
  if (salesResult.status === "fulfilled" && salesResult.value) {
    const payload = salesResult.value?.payload || salesResult.value || []
    result.sales_metrics = payload
  } else {
    // Fall back: we'll build chart data from orders on the client side
    result.sales_metrics = null
    if (salesResult.status === "rejected") {
      result.errors.push(`Sales API: ${salesResult.reason?.message}`)
    }
  }

  return NextResponse.json(result)
}
