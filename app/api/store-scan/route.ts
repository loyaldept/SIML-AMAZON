import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Fetch channel connections
  const { data: channels } = await supabase
    .from("channel_connections")
    .select("channel, status, store_name, seller_id")
    .eq("user_id", user.id)

  const connectedChannels =
    channels?.filter((c) => c.status === "connected") || []

  // Fetch inventory
  const { data: inventory } = await supabase
    .from("inventory")
    .select("*")
    .eq("user_id", user.id)

  const items = inventory || []
  const totalItems = items.length
  const totalUnits = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
  const totalValue = items.reduce(
    (sum, i) => sum + (i.price || 0) * (i.quantity || 0),
    0
  )

  // Stock analysis
  const outOfStock = items.filter((i) => (i.quantity || 0) === 0).length
  const lowStock = items.filter(
    (i) => (i.quantity || 0) > 0 && (i.quantity || 0) <= 5
  ).length
  const healthy = items.filter((i) => (i.quantity || 0) > 5).length

  // Fetch orders
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)

  const allOrders = orders || []
  const totalOrders = allOrders.length
  const totalRevenue = allOrders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  )
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const canceledOrders = allOrders.filter(
    (o) => o.status === "Canceled"
  ).length
  const shippedOrders = allOrders.filter((o) => o.status === "Shipped").length
  const fulfillmentRate =
    totalOrders > 0 ? (shippedOrders / totalOrders) * 100 : 0
  const cancelRate =
    totalOrders > 0 ? (canceledOrders / totalOrders) * 100 : 0

  // Generate recommendations
  const recommendations: string[] = []

  if (outOfStock > 0) {
    recommendations.push(
      `${outOfStock} product${outOfStock > 1 ? "s are" : " is"} out of stock. Consider restocking to avoid lost sales.`
    )
  }

  if (lowStock > 0) {
    recommendations.push(
      `${lowStock} product${lowStock > 1 ? "s have" : " has"} low stock (5 or fewer units). Plan ahead to reorder.`
    )
  }

  if (cancelRate > 5) {
    recommendations.push(
      `Your cancellation rate is ${cancelRate.toFixed(1)}%. This is above the 2.5% threshold. Review order fulfillment processes.`
    )
  }

  if (fulfillmentRate < 95 && totalOrders > 0) {
    recommendations.push(
      `Fulfillment rate is ${fulfillmentRate.toFixed(1)}%. Aim for 95%+ to maintain account health.`
    )
  }

  if (totalItems === 0) {
    recommendations.push(
      "Your inventory is empty. Start by listing products from the List page."
    )
  }

  if (connectedChannels.length === 1) {
    recommendations.push(
      "You're only selling on one channel. Consider expanding to eBay or Shopify to diversify revenue."
    )
  }

  if (totalOrders > 0 && avgOrderValue < 15) {
    recommendations.push(
      `Average order value is $${avgOrderValue.toFixed(2)}. Consider bundling products or repricing to increase AOV.`
    )
  }

  // Always add at least one positive recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      "Your store looks great! Keep monitoring inventory levels and pricing to stay competitive."
    )
  }

  // Health status
  let healthStatus = "Good"
  if (outOfStock > 0 || cancelRate > 5 || fulfillmentRate < 90) {
    healthStatus = "Needs Attention"
  }
  if (cancelRate > 10 || fulfillmentRate < 80) {
    healthStatus = "At Risk"
  }

  return Response.json({
    channels: connectedChannels.map((c) => ({
      channel: c.channel,
      storeName: c.store_name,
    })),
    health: {
      status: healthStatus,
      stats: {
        "Connected Stores": connectedChannels.length,
        "Account Status": healthStatus,
        "Fulfillment Rate": `${fulfillmentRate.toFixed(1)}%`,
      },
    },
    inventory: {
      totalItems,
      totalUnits,
      totalValue,
    },
    alerts: {
      outOfStock,
      lowStock,
      healthy,
    },
    performance: {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      shippedOrders,
      canceledOrders,
      fulfillmentRate,
      cancelRate,
    },
    recommendations,
  })
}
