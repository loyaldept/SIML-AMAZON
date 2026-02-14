"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { TrendingUp, TrendingDown, Bell, Menu, Package, DollarSign, ShoppingCart, BarChart3, Loader2, Link2, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

type ChartType = "revenue" | "orders"
type TimeRange = "7d" | "30d" | "90d" | "all"

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const amazonJustConnected = searchParams.get("amazon") === "connected"
  const [showBanner, setShowBanner] = useState(amazonJustConnected)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState("")
  const [userName, setUserName] = useState("")

  // Real Amazon data from SP-API
  const [amazonData, setAmazonData] = useState<any>(null)
  const [amazonConnected, setAmazonConnected] = useState(false)
  const [channels, setChannels] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])

  const [chartType, setChartType] = useState<ChartType>("revenue")
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login"); return }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    setUserName(profile?.full_name || profile?.first_name || user.email?.split("@")[0] || "Seller")

    const { data: ch } = await supabase.from("channel_connections").select("channel, status, store_name").eq("user_id", user.id)
    setChannels(ch || [])

    const isAmazonConnected = ch?.some(c => c.channel === "Amazon" && c.status === "connected") || false
    setAmazonConnected(isAmazonConnected)

    // Load listings from Supabase
    const { data: lsts } = await supabase.from("listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
    setListings(lsts || [])

    // Load notifications
    const { data: notifs } = await supabase.from("notifications").select("*").eq("user_id", user.id).eq("read", false).order("created_at", { ascending: false }).limit(5)
    setNotifications(notifs || [])

    setLoading(false)

    // If Amazon is connected, sync real data
    if (isAmazonConnected) {
      syncAmazonData()
    }
  }

  const syncAmazonData = async () => {
    setSyncing(true)
    setSyncError("")
    try {
      const res = await fetch("/api/amazon/dashboard")
      const data = await res.json()
      if (data.connected) {
        setAmazonData(data)
        // Prefer db_orders (Supabase normalized) over raw SP-API orders
        setOrders(data.db_orders || data.orders || [])
      } else if (data.error) {
        setSyncError(data.error)
      }
    } catch (e: any) {
      setSyncError(e.message)
    }
    setSyncing(false)
  }

  // Filter orders by selected time range
  const getFilteredOrders = () => {
    if (timeRange === "all") return orders
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return orders.filter((o: any) => {
      const date = o.PurchaseDate || o.purchase_date || o.order_date
      if (!date) return false
      return new Date(date) >= cutoff
    })
  }

  const filteredOrders = getFilteredOrders()

  // Calculate stats from filtered orders - handle both SP-API format and Supabase format
  const totalRevenue = filteredOrders.reduce((sum: number, o: any) => {
    const amount = parseFloat(o.OrderTotal?.Amount || o.total_amount || o.order_total || "0")
    return sum + (isNaN(amount) ? 0 : amount)
  }, 0)
  const totalOrders = filteredOrders.length
  const shippedOrders = filteredOrders.filter((o: any) => {
    const status = o.OrderStatus || o.status
    return status === "Shipped"
  }).length
  const pendingOrders = filteredOrders.filter((o: any) => {
    const status = o.OrderStatus || o.status
    return status === "Unshipped" || status === "PartiallyShipped" || status === "Pending"
  }).length
  const totalInventory = amazonData?.fba_total_units || 0
  const totalSkus = amazonData?.fba_total_skus || 0

  // If filtered stats are 0 but API has pre-calculated totals for "all" view, use those
  const displayRevenue = totalRevenue > 0 ? totalRevenue : (timeRange === "all" || timeRange === "90d" ? (amazonData?.total_revenue || 0) : totalRevenue)
  const displayOrders = totalOrders > 0 ? totalOrders : (timeRange === "all" || timeRange === "90d" ? (amazonData?.order_count || 0) : totalOrders)

  const timeRangeLabel = timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : timeRange === "90d" ? "90 days" : "all time"

  // Build chart data from REAL orders
  const getChartData = () => {
    if (timeRange === "all" && orders.length > 0) {
      // For "all time", find the earliest order and show monthly buckets
      const sorted = [...orders].filter((o: any) => o.PurchaseDate || o.purchase_date || o.order_date).sort((a: any, b: any) =>
        new Date(a.PurchaseDate || a.purchase_date || a.order_date).getTime() - new Date(b.PurchaseDate || b.purchase_date || b.order_date).getTime()
      )
      if (sorted.length === 0) return []

      const firstDate = new Date(sorted[0].PurchaseDate || sorted[0].purchase_date || sorted[0].order_date)
      const now = new Date()
      const buckets: Record<string, { revenue: number; orders: number }> = {}

      // Monthly buckets for all time
      const current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
      while (current <= now) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
        buckets[key] = { revenue: 0, orders: 0 }
        current.setMonth(current.getMonth() + 1)
      }

      for (const order of orders) {
        const dateStr = order.PurchaseDate || order.purchase_date || order.order_date
        if (!dateStr) continue
        const d = new Date(dateStr)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (buckets[key]) {
          buckets[key].orders++
          const amt = parseFloat(order.OrderTotal?.Amount || order.total_amount || order.order_total || "0")
          if (!isNaN(amt)) buckets[key].revenue += amt
        }
      }

      return Object.entries(buckets).map(([key, data]) => {
        const [y, m] = key.split("-")
        return {
          date: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders,
        }
      })
    }

    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const now = new Date()
    const buckets: Record<string, { revenue: number; orders: number }> = {}

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      buckets[key] = { revenue: 0, orders: 0 }
    }

    for (const order of orders) {
      const dateStr = order.PurchaseDate || order.purchase_date || order.order_date
      if (!dateStr) continue
      const orderDate = new Date(dateStr).toISOString().slice(0, 10)
      if (buckets[orderDate]) {
        buckets[orderDate].orders++
        const amt = parseFloat(order.OrderTotal?.Amount || order.total_amount || order.order_total || "0")
        if (!isNaN(amt)) buckets[orderDate].revenue += amt
      }
    }

    return Object.entries(buckets).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }))
  }

  const chartData = getChartData()

  const connectedChannels = channels.filter(c => c.status === "connected")

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FBFBF9]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          <p className="text-sm text-stone-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col relative bg-[#FBFBF9] h-full">
        {/* Amazon Connected Success Banner */}
        {showBanner && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-800 font-medium">Amazon Seller account connected successfully! Syncing your data...</p>
            </div>
            <button onClick={() => setShowBanner(false)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Dismiss</button>
          </div>
        )}

        {/* Sync Error Banner */}
        {syncError && (
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800 font-medium">Sync issue: {syncError}</p>
            </div>
            <button onClick={() => setSyncError("")} className="text-amber-600 hover:text-amber-800 text-xs font-medium">Dismiss</button>
          </div>
        )}

        {/* Header */}
        <header className="h-14 px-4 md:px-6 flex items-center justify-between shrink-0 border-b border-stone-100/50">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-2 text-stone-500">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium text-stone-500">
              {"Welcome back, "}<span className="text-stone-900">{userName}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {amazonConnected && (
              <button
                onClick={syncAmazonData}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 font-medium disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Refresh"}
              </button>
            )}
            <div className="h-4 w-px bg-stone-200 mx-1 hidden sm:block" />
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </Link>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Channel Connection Status - only show real channels */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {/* Always show Amazon */}
              <div className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium whitespace-nowrap",
                amazonConnected ? "bg-white border-emerald-200 text-stone-900" : "bg-white border-stone-200 text-stone-400"
              )}>
                <div className={cn("w-2 h-2 rounded-full", amazonConnected ? "bg-emerald-500" : "bg-stone-300")} />
                Amazon
                {amazonConnected ? (
                  <span className="text-[10px] text-emerald-600 font-medium ml-1">
                    {amazonData?.store_name || "Connected"}
                  </span>
                ) : (
                  <a href="/api/amazon/auth" className="text-[10px] text-stone-500 font-medium ml-1 hover:text-stone-900 flex items-center gap-0.5">
                    <Link2 className="w-2.5 h-2.5" />
                    Connect
                  </a>
                )}
              </div>

              {/* Only show eBay/Shopify if actually connected */}
              {channels.filter(c => c.channel !== "Amazon" && c.status === "connected").map(ch => (
                <div key={ch.channel} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-white border-emerald-200 text-stone-900 text-sm font-medium whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  {ch.channel}
                  <span className="text-[10px] text-emerald-600 font-medium ml-1">Connected</span>
                </div>
              ))}
            </div>

            {/* No channels connected state */}
            {!amazonConnected && connectedChannels.length === 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
                <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-stone-900 mb-1">Connect your seller account</h3>
                <p className="text-sm text-stone-500 mb-4">Connect your Amazon Seller account to see your real sales data, inventory, and analytics.</p>
                <a href="/api/amazon/auth" className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors">
                  <Link2 className="w-4 h-4" />
                  Connect Amazon Seller
                </a>
              </div>
            )}

            {/* Stats Grid - only show real data */}
            {(amazonConnected || connectedChannels.length > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-stone-100">
                      <DollarSign className="w-4 h-4 text-stone-600" />
                    </div>
                    {syncing && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
                  </div>
                  <div className="text-2xl font-semibold text-stone-900 font-serif">${displayRevenue.toFixed(2)}</div>
                  <div className="text-xs text-stone-500 mt-1">Revenue ({timeRangeLabel})</div>
                </div>

                <div className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-stone-100">
                      <ShoppingCart className="w-4 h-4 text-stone-600" />
                    </div>
                    <div className="flex items-center gap-2">
                      {pendingOrders > 0 && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{pendingOrders} pending</span>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-stone-900 font-serif">{displayOrders}</div>
                  <div className="text-xs text-stone-500 mt-1">Orders ({timeRangeLabel}) &middot; {shippedOrders} shipped</div>
                </div>

                <div className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-stone-100">
                      <Package className="w-4 h-4 text-stone-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-stone-900 font-serif">{totalInventory}</div>
                  <div className="text-xs text-stone-500 mt-1">FBA Units &middot; {totalSkus} SKUs</div>
                </div>

                <div className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-stone-100">
                      <BarChart3 className="w-4 h-4 text-stone-600" />
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-stone-900 font-serif">{amazonData?.participations?.length || 0}</div>
                  <div className="text-xs text-stone-500 mt-1">Active Marketplaces</div>
                </div>
              </div>
            )}

            {/* Sales Chart - only if we have real data */}
            {amazonConnected && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-stone-400" />
                    <h3 className="text-lg font-semibold text-stone-900">Sales Analytics</h3>
                    <span className="text-xs text-stone-400 font-medium">(Amazon)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-stone-100 rounded-lg p-1">
                      {[{ id: "revenue" as ChartType, label: "Revenue" }, { id: "orders" as ChartType, label: "Orders" }].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setChartType(tab.id)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            chartType === tab.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700",
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                      className="bg-stone-100 border-0 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-700 focus:ring-2 focus:ring-stone-300"
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                </div>

                {orders.length === 0 && !syncing ? (
                  <div className="h-72 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-sm text-stone-500">No order data yet for this period</p>
                      <p className="text-xs text-stone-400 mt-1">Data will appear here as orders come in</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "orders" ? (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: "8px", fontSize: "12px" }} />
                          <Bar dataKey="orders" fill="#292524" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: "8px", fontSize: "12px" }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="#292524" strokeWidth={2} dot={{ fill: "#292524", strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: "#292524" }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Recent Orders from Amazon */}
            {amazonConnected && orders.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-stone-900">Recent Amazon Orders</h3>
                  <span className="text-xs text-stone-400 font-medium">{orders.length} orders</span>
                </div>
                <div className="space-y-2">
                  {orders.slice(0, 8).map((order: any) => (
                    <div key={order.AmazonOrderId} className="flex items-center justify-between py-2.5 border-b border-stone-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-stone-900">{order.AmazonOrderId}</div>
                        <div className="text-xs text-stone-500">
                          {new Date(order.PurchaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" "}
                          &middot; {(order.NumberOfItemsShipped || 0) + (order.NumberOfItemsUnshipped || 0)} item(s)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-stone-900">
                          {order.OrderTotal ? `$${parseFloat(order.OrderTotal.Amount).toFixed(2)}` : "--"}
                        </div>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          order.OrderStatus === "Shipped" ? "text-emerald-700 bg-emerald-50" :
                          order.OrderStatus === "Unshipped" ? "text-amber-700 bg-amber-50" :
                          "text-stone-600 bg-stone-100"
                        )}>
                          {order.OrderStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FBA Inventory Summary */}
            {amazonConnected && amazonData?.fba_inventory?.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-stone-900">FBA Inventory</h3>
                  <Link href="/inventory" className="text-xs font-medium text-stone-500 hover:text-stone-900">View all</Link>
                </div>
                <div className="space-y-2">
                  {amazonData.fba_inventory.slice(0, 8).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-stone-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-stone-900">{item.productName || item.asin}</div>
                        <div className="text-xs text-stone-500">ASIN: {item.asin} &middot; SKU: {item.sellerSku || "N/A"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-stone-900">{item.totalQuantity || 0} units</div>
                        <div className="text-xs text-stone-400">
                          {item.inventoryDetails?.fulfillableQuantity || 0} available
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Listings */}
            {listings.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-stone-900">Recent Listings</h3>
                  <Link href="/list" className="text-xs font-medium text-stone-500 hover:text-stone-900">View all</Link>
                </div>
                <div className="space-y-3">
                  {listings.slice(0, 5).map((listing) => (
                    <div key={listing.id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                      <div className="flex items-center gap-3">
                        {listing.image_url ? (
                          <img src={listing.image_url} alt="" className="w-10 h-10 rounded-lg object-contain bg-stone-50 border border-stone-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-stone-500" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-stone-900 line-clamp-1">{listing.title}</div>
                          <div className="text-xs text-stone-500">{listing.channel} &middot; {listing.sku}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-stone-900">${Number(listing.price).toFixed(2)}</div>
                        <div className={cn("text-[10px] font-medium", listing.status === "active" ? "text-emerald-600" : "text-stone-400")}>{listing.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-stone-900">Recent Notifications</h3>
                  <Link href="/notifications" className="text-xs font-medium text-stone-500 hover:text-stone-900">View all</Link>
                </div>
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 py-2 border-b border-stone-100 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-stone-900">{n.title}</p>
                        <p className="text-xs text-stone-500">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
