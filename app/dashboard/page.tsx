"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown, Bell, Menu, Package, DollarSign, ShoppingCart, BarChart3 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { storage } from "@/lib/storage"
import type { InventoryItem, Sale } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

type ChartType = "revenue" | "profit" | "orders"
type TimeRange = "7d" | "30d" | "90d"
type Marketplace = "all" | "amazon" | "ebay" | "shopify"

export default function DashboardPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [chartType, setChartType] = useState<ChartType>("revenue")
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [marketplace, setMarketplace] = useState<Marketplace>("all")

  useEffect(() => {
    setInventory(storage.getInventory())
    setSales(storage.getSales())
  }, [])

  // Filter sales by marketplace
  const filteredSales = marketplace === "all" 
    ? sales 
    : sales.filter((sale) => sale.channel.toLowerCase().includes(marketplace))

  // Calculate stats
  const totalInventory = inventory.reduce((sum, item) => sum + item.quantity, 0)
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.revenue, 0)
  const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0)
  const totalOrders = filteredSales.length

  const getChartData = () => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const data = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      const daySales = filteredSales.filter((sale) => {
        const saleDate = new Date(sale.saleDate)
        return saleDate.toDateString() === date.toDateString()
      })

      data.push({
        date: dateStr,
        revenue: daySales.reduce((sum, s) => sum + s.revenue, 0),
        profit: daySales.reduce((sum, s) => sum + s.profit, 0),
        orders: daySales.length,
      })
    }

    return data
  }

  const chartData = getChartData()

  const stats = [
    {
      label: "Total Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
    },
    {
      label: "Total Profit",
      value: `$${totalProfit.toFixed(2)}`,
      change: "+8.2%",
      trend: "up",
      icon: TrendingUp,
    },
    {
      label: "Orders",
      value: totalOrders.toString(),
      change: "+5.1%",
      trend: "up",
      icon: ShoppingCart,
    },
    {
      label: "Inventory Units",
      value: totalInventory.toString(),
      change: "-2.3%",
      trend: "down",
      icon: Package,
    },
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
              Workspace / <span className="text-stone-900">Dashboard</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 font-medium hidden sm:block">Last sync: 2 mins ago</span>
            <div className="h-4 w-px bg-stone-200 mx-1 hidden sm:block" />
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
            </Link>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
          <div className="max-w-6xl mx-auto space-y-6">
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
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-stone-100">
                        <Icon className="w-4 h-4 text-stone-600" />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium flex items-center gap-0.5",
                          stat.trend === "up" ? "text-emerald-600" : "text-red-500",
                        )}
                      >
                        {stat.trend === "up" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
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
                  {marketplace !== "all" && (
                    <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-full capitalize">
                      {marketplace}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Chart Type Tabs */}
                  <div className="flex items-center bg-stone-100 rounded-lg p-1">
                    {chartTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setChartType(tab.id)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                          chartType === tab.id
                            ? "bg-white text-stone-900 shadow-sm"
                            : "text-stone-500 hover:text-stone-700",
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Time Range Select */}
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

              {/* Chart */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "orders" ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#78716c" }}
                        tickLine={false}
                        axisLine={{ stroke: "#e7e5e4" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e7e5e4",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="orders" fill="#292524" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#78716c" }}
                        tickLine={false}
                        axisLine={{ stroke: "#e7e5e4" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#78716c" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e7e5e4",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [
                          `$${value.toFixed(2)}`,
                          chartType === "revenue" ? "Revenue" : "Profit",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey={chartType}
                        stroke="#292524"
                        strokeWidth={2}
                        dot={{ fill: "#292524", strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5, fill: "#292524" }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="text-lg font-semibold text-stone-900 mb-4">Recent Sales</h3>
              <div className="space-y-3">
                {filteredSales.slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-stone-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-stone-900">{sale.productTitle}</div>
                        <div className="text-xs text-stone-500">{sale.channel}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-stone-900">${sale.revenue.toFixed(2)}</div>
                      <div className="text-xs text-emerald-600">+${sale.profit.toFixed(2)} profit</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
