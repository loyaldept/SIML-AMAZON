import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAmazonToken,
  getSellerInfo,
  getAllOrders,
  getAllFbaInventory,
  getOrderMetrics,
  getMyPrice,
  getCompetitivePricing,
} from "@/lib/amazon-sp-api"

export const maxDuration = 55

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

  // Time periods for fetching - use 120 days to ensure complete coverage
  const now = new Date()
  const fetchSince = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString()

  // Build Sales API interval for last 90 days (covers 7d, 30d, and 90d views)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const salesInterval = `${ninetyDaysAgo}--${now.toISOString()}`

  // Run all SP-API calls in parallel - using getAllOrders with pagination
  const [sellerResult, ordersResult, inventoryResult, salesResult] = await Promise.allSettled([
    getSellerInfo(accessToken),
    getAllOrders(accessToken, marketplaceIds, fetchSince),
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

  // 2. Orders - getAllOrders returns a flat array (already paginated)
  if (ordersResult.status === "fulfilled") {
    const orders = ordersResult.value || []
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

    // Sync ALL orders to Supabase
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

  // 3. FBA Inventory (all pages) + sync prices
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

    // Fetch prices for inventory items (batch of 20)
    const allAsins = [...new Set(summaries.map((s: any) => s.asin).filter(Boolean))]
    const priceMap: Record<string, number> = {}

    for (let i = 0; i < allAsins.length; i += 20) {
      const batch = allAsins.slice(i, i + 20)
      try {
        const priceData: any = await getMyPrice(accessToken, marketplaceId, batch)
        const prices = priceData?.payload || priceData || []
        if (Array.isArray(prices)) {
          for (const p of prices) {
            const asin = p.ASIN || p.asin
            if (p.status === "ClientError" || p.status === "ServerError") continue
            const offer = p.Product?.Offers?.[0]
            const price = offer?.BuyingPrice?.LandedPrice || offer?.BuyingPrice?.ListingPrice || offer?.RegularPrice
            if (asin && price) {
              priceMap[asin] = parseFloat(String(price.Amount || "0"))
            }
          }
        }
      } catch (e: any) {
        console.log("[Dashboard] getMyPrice error:", e?.message)
      }
    }

    // Fallback: competitive pricing for items still missing prices
    const missingAsins = allAsins.filter(a => !priceMap[a])
    if (missingAsins.length > 0) {
      for (let i = 0; i < missingAsins.length; i += 20) {
        const batch = missingAsins.slice(i, i + 20)
        try {
          const compData: any = await getCompetitivePricing(accessToken, marketplaceId, batch)
          const items = compData?.payload || compData || []
          if (Array.isArray(items)) {
            for (const item of items) {
              const asin = item.ASIN || item.asin
              if (item.status === "ClientError" || item.status === "ServerError") continue
              const cps = item.Product?.CompetitivePricing?.CompetitivePrices || []
              const buyBox = cps.find((cp: any) => cp.CompetitivePriceId === "1")
              const price = buyBox?.Price?.LandedPrice || buyBox?.Price?.ListingPrice
              if (asin && price) {
                priceMap[asin] = parseFloat(String(price.Amount || "0"))
              }
            }
          }
        } catch (e: any) {
          console.log("[Dashboard] competitive pricing error:", e?.message)
        }
      }
    }

    // Sync FBA inventory to Supabase with prices
    const invUpserts = summaries.map((item: any) => {
      const qty = item.inventoryDetails?.fulfillableQuantity || item.totalQuantity || 0
      const upsertData: any = {
        user_id: user.id,
        asin: item.asin,
        sku: item.sellerSku,
        title: item.productName || item.sellerSku || item.asin,
        quantity: qty,
        channel: "FBA",
        status: qty > 0 ? "active" : "out_of_stock",
        fulfillment_channel: item.inventoryDetails ? "FBA" : "FBM",
        fnsku: item.fnSku || null,
        updated_at: new Date().toISOString(),
      }
      if (priceMap[item.asin]) {
        upsertData.price = priceMap[item.asin]
      }
      return supabase.from("inventory").upsert(upsertData, { onConflict: "user_id,asin" })
    })
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
    result.sales_metrics = null
    if (salesResult.status === "rejected") {
      result.errors.push(`Sales API: ${salesResult.reason?.message}`)
    }
  }

  return NextResponse.json(result)
}
