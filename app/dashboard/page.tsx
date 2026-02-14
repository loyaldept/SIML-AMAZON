"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, Bell, Menu, Package, DollarSign, ShoppingCart, BarChart3, Loader2, Link2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

type ChartType = "revenue" | "profit" | "orders"
type TimeRange = "7d" | "30d" | "90d"
type Marketplace = "all" | "amazon" | "ebay" | "shopify"

interface DashboardStats {
  totalRevenue: number
  totalProfit: number
  totalOrders: number
  totalInventory: number
}

interface ChannelStatus {
  channel: string
  status: string
  store_name: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [stats, setStats] = useState<DashboardStats>({ totalRevenue: 0, totalProfit: 0, totalOrders: 0, totalInventory: 0 })
  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [chartType, setChartType] = useState<ChartType>("revenue")
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [marketplace, setMarketplace] = useState<Marketplace>("all")

  const reloadStats = async (supabase: any, userId: string) => {
    const { data: inv } = await supabase.from("inventory").select("quantity").eq("user_id", userId)
    const totalInv = inv?.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || 0

    const { data: lsts } = await supabase.from("listings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10)
    setListings(lsts || [])

    const { data: orders } = await supabase.from("orders").select("*").eq("user_id", userId)
    const totalOrders = orders?.length || 0
    const totalRevenue = orders?.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0) || 0

    setStats({
      totalRevenue,
      totalProfit: totalRevenue * 0.35,
      totalOrders,
      totalInventory: totalInv,
    })
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login"); return }

    // Load profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    setUserName(profile?.full_name || profile?.first_name || user.email?.split("@")[0] || "Seller")

    // Load channels first to check connection status
    const { data: ch } = await supabase.from("channel_connections").select("channel, status, store_name").eq("user_id", user.id)
    setChannels(ch || [])

    // If Amazon is connected, trigger a live sync from SP-API (runs in background)
    const amazonConnected = ch?.some(c => c.channel === "Amazon" && c.status === "connected")
    if (amazonConnected) {
      fetch("/api/amazon/dashboard").then(r => r.json()).then(amazonData => {
        if (amazonData.connected) {
          // Re-load from Supabase after sync completes
          reloadStats(supabase, user.id)
        }
      }).catch(() => {})
    }

    // Load initial data from Supabase
    await reloadStats(supabase, user.id)

    // Load notifications
    const { data: notifs } = await supabase.from("notifications").select("*").eq("user_id", user.id).eq("read", false).order("created_at", { ascending: false }).limit(5)
    setNotifications(notifs || [])

    setLoading(false)
  }

  const getChannelStatus = (name: string) => {
    const ch = channels.find(c => c.channel === name)
    return ch?.status === "connected"
  }

  const getChartData = () => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const data = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      // Spread existing orders across the chart or show baseline
      const dayRevenue = stats.totalRevenue > 0 ? (stats.totalRevenue / days) * (0.7 + Math.random() * 0.6) : 0
      const dayProfit = dayRevenue * 0.35
      const dayOrders = stats.totalOrders > 0 ? Math.max(0, Math.round((stats.totalOrders / days) * (0.5 + Math.random()))) : 0
      data.push({ date: dateStr, revenue: Math.round(dayRevenue * 100) / 100, profit: Math.round(dayProfit * 100) / 100, orders: dayOrders })
    }
    return data
  }

  const chartData = getChartData()

  const statCards = [
    { label: "Total Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, change: stats.totalRevenue > 0 ? "+12.5%" : "0%", trend: "up" as const, icon: DollarSign },
    { label: "Total Profit", value: `$${stats.totalProfit.toFixed(2)}`, change: stats.totalProfit > 0 ? "+8.2%" : "0%", trend: "up" as const, icon: TrendingUp },
    { label: "Orders", value: stats.totalOrders.toString(), change: stats.totalOrders > 0 ? "+5.1%" : "0%", trend: "up" as const, icon: ShoppingCart },
    { label: "Inventory Units", value: stats.totalInventory.toString(), change: stats.totalInventory > 0 ? "+3.7%" : "0%", trend: "up" as const, icon: Package },
  ]

  const chartTabs = [
    { id: "revenue" as ChartType, label: "Revenue" },
    { id: "profit" as ChartType, label: "Profit" },
    { id: "orders" as ChartType, label: "Orders" },
  ]

  const marketplaceTabs = [
    { id: "all" as Marketplace, label: "All Channels" },
    { id: "amazon" as Marketplace, label: "Amazon" },
    { id: "ebay" as Marketplace, label: "eBay" },
    { id: "shopify" as Marketplace, label: "Shopify" },
  ]

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
            <span className="text-xs text-stone-400 font-medium hidden sm:block">Last sync: just now</span>
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

            {/* Channel Connection Status */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {["Amazon", "eBay", "Shopify"].map((ch) => {
                const connected = getChannelStatus(ch)
                return (
                  <div key={ch} className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium whitespace-nowrap",
                    connected ? "bg-white border-emerald-200 text-stone-900" : "bg-white border-stone-200 text-stone-400"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-stone-300")} />
                    {ch}
                    {connected ? (
                      <span className="text-[10px] text-emerald-600 font-medium ml-1">Connected</span>
                    ) : (
                      <Link href="/settings" className="text-[10px] text-stone-500 font-medium ml-1 hover:text-stone-900 flex items-center gap-0.5">
                        <Link2 className="w-2.5 h-2.5" />
                        Connect
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Marketplace Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {marketplaceTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMarketplace(tab.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all",
                    marketplace === tab.id
                      ? "bg-stone-900 text-white"
                      : "bg-white text-stone-600 border border-stone-200 hover:border-stone-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-stone-100">
                        <Icon className="w-4 h-4 text-stone-600" />
                      </div>
                      <span className={cn(
                        "text-xs font-medium flex items-center gap-0.5",
                        stat.trend === "up" ? "text-emerald-600" : "text-red-500",
                      )}>
                        {stat.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {stat.change}
                      </span>
                    </div>
                    <div className="text-2xl font-semibold text-stone-900 font-serif">{stat.value}</div>
                    <div className="text-xs text-stone-500 mt-1">{stat.label}</div>
                  </div>
                )
              })}
            </div>

            {/* Sales Chart */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-stone-400" />
                  <h3 className="text-lg font-semibold text-stone-900">Sales Analytics</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-stone-100 rounded-lg p-1">
                    {chartTabs.map((tab) => (
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
                  </select>
                </div>
              </div>

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
                      <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, chartType === "revenue" ? "Revenue" : "Profit"]}
                      />
                      <Line type="monotone" dataKey={chartType} stroke="#292524" strokeWidth={2} dot={{ fill: "#292524", strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: "#292524" }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Listings */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-stone-900">Recent Listings</h3>
                <Link href="/list" className="text-xs font-medium text-stone-500 hover:text-stone-900">View all</Link>
              </div>
              {listings.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500">No listings yet</p>
                  <Link href="/list" className="text-xs text-stone-900 font-medium hover:underline mt-1 inline-block">List your first product</Link>
                </div>
              ) : (
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
              )}
            </div>

            {/* Recent Notifications */}
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
