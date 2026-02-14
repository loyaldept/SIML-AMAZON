"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Truck, Package, Bell, Menu, Plus, RefreshCw, Loader2, MapPin, Tag, Printer, Search, AlertCircle, X } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface OrderRow {
  id: string
  amazon_order_id: string
  status: string
  total_amount: number
  currency: string
  items_count: number
  buyer_email: string | null
  order_date: string
  raw_data: any
}

export default function ShipmentsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [amazonConnected, setAmazonConnected] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  // Label modal
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [labelLoading, setLabelLoading] = useState(false)
  const [labelRates, setLabelRates] = useState<any[]>([])
  const [labelForm, setLabelForm] = useState({
    shipFromName: "", shipFromAddress: "", shipFromCity: "", shipFromState: "", shipFromZip: "",
    weightValue: "1", lengthCm: "25", widthCm: "20", heightCm: "10",
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: conn } = await supabase
      .from("channel_connections").select("status")
      .eq("user_id", user.id).eq("channel", "Amazon").single()
    setAmazonConnected(conn?.status === "connected")

    const { data } = await supabase
      .from("orders").select("*")
      .eq("user_id", user.id)
      .order("order_date", { ascending: false }).limit(50)
    if (data) setOrders(data)
    setLoading(false)
  }

  const handleSyncOrders = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/amazon/orders?days=30")
      if (res.ok) await loadData()
    } catch (e) { console.log("[v0] Sync error:", e) }
    setSyncing(false)
  }

  const handleGetRates = async () => {
    if (!selectedOrder) return
    setLabelLoading(true)
    const addr = selectedOrder.raw_data?.ShippingAddress || {}
    try {
      const res = await fetch("/api/amazon/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rates",
          shipmentData: {
            shipFrom: {
              name: labelForm.shipFromName, addressLine1: labelForm.shipFromAddress,
              city: labelForm.shipFromCity, stateOrRegion: labelForm.shipFromState,
              postalCode: labelForm.shipFromZip, countryCode: "US",
            },
            shipTo: {
              name: addr.Name || "", addressLine1: addr.AddressLine1 || "",
              city: addr.City || "", stateOrRegion: addr.StateOrRegion || "",
              postalCode: addr.PostalCode || "", countryCode: addr.CountryCode || "US",
            },
            packages: [{
              weight: { value: parseFloat(labelForm.weightValue), unit: "POUND" },
              dimensions: {
                length: parseFloat(labelForm.lengthCm), width: parseFloat(labelForm.widthCm),
                height: parseFloat(labelForm.heightCm), unit: "CENTIMETER",
              },
            }],
          },
        }),
      })
      const data = await res.json()
      setLabelRates(data?.payload?.serviceRates || data?.serviceRates || [])
    } catch (e) { console.log("[v0] Rates error:", e) }
    setLabelLoading(false)
  }

  const handlePurchaseLabel = async (rateId: string) => {
    setLabelLoading(true)
    try {
      const res = await fetch("/api/amazon/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", shipmentData: { rateId } }),
      })
      const data = await res.json()
      if (data?.payload?.labelResult?.label?.labelStream) {
        const link = document.createElement("a")
        link.href = `data:application/pdf;base64,${data.payload.labelResult.label.labelStream}`
        link.download = `label-${selectedOrder?.amazon_order_id || "shipment"}.pdf`
        link.click()
      }
    } catch (e) { console.log("[v0] Purchase label error:", e) }
    setLabelLoading(false)
    setShowLabelModal(false)
  }

  const statusColors: Record<string, string> = {
    Shipped: "bg-emerald-100 text-emerald-700",
    Unshipped: "bg-amber-100 text-amber-700",
    PartiallyShipped: "bg-blue-100 text-blue-700",
    Pending: "bg-stone-100 text-stone-600",
    Canceled: "bg-red-100 text-red-700",
  }

  const filtered = orders.filter((o) => {
    const matchSearch = !searchQuery || o.amazon_order_id?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchFilter = filterStatus === "all" || o.status === filterStatus
    return matchSearch && matchFilter
  })

  return (
    <div className="flex h-screen bg-[#FBFBF9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-14 border-b border-stone-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-stone-400" />
            <h1 className="text-base font-semibold text-stone-900">Shipments & Labels</h1>
          </div>
          <div className="flex items-center gap-2">
            {amazonConnected && (
              <Button variant="outline" size="sm" className="gap-1.5 bg-transparent text-xs" onClick={handleSyncOrders} disabled={syncing}>
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? "Syncing..." : "Sync Orders"}
              </Button>
            )}
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-24">
          <div className="max-w-4xl mx-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-stone-300 animate-spin mb-4" />
                <p className="text-sm text-stone-500">Loading shipments...</p>
              </div>
            ) : !amazonConnected ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
                  <Truck className="w-8 h-8 text-stone-300" />
                </div>
                <h2 className="text-lg font-semibold text-stone-900 mb-2">Connect Amazon to manage shipments</h2>
                <p className="text-sm text-stone-500 mb-6 max-w-sm">
                  Connect your Amazon Seller account to sync orders, create shipments, and print shipping labels.
                </p>
                <Link href="/settings">
                  <Button className="gap-2"><Plus className="w-4 h-4" />Connect Amazon</Button>
                </Link>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
                  <Package className="w-8 h-8 text-stone-300" />
                </div>
                <h2 className="text-lg font-semibold text-stone-900 mb-2">No orders found</h2>
                <p className="text-sm text-stone-500 mb-6 max-w-sm">
                  Sync your Amazon orders to see them here. Orders from the last 30 days will be fetched.
                </p>
                <Button className="gap-2" onClick={handleSyncOrders} disabled={syncing}>
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total Orders", value: orders.length },
                    { label: "Unshipped", value: orders.filter((o) => o.status === "Unshipped").length },
                    { label: "Shipped", value: orders.filter((o) => o.status === "Shipped").length },
                    { label: "Pending", value: orders.filter((o) => o.status === "Pending").length },
                  ].map((s) => (
                    <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-4">
                      <div className="text-2xl font-semibold text-stone-900">{s.value}</div>
                      <div className="text-xs text-stone-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by order ID..." className="pl-10 h-9 text-sm" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {["all", "Unshipped", "Shipped", "Pending", "Canceled"].map((s) => (
                      <button key={s} onClick={() => setFilterStatus(s)} className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        filterStatus === s ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                      )}>
                        {s === "all" ? "All" : s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders list */}
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-stone-100">
                    <h3 className="text-sm font-medium text-stone-900">{filtered.length} Order{filtered.length !== 1 ? "s" : ""}</h3>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {filtered.map((order) => (
                      <div key={order.id} className="px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-stone-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-stone-900 font-mono truncate">{order.amazon_order_id}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-stone-500">
                                {order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}
                              </span>
                              <span className="text-[10px] text-stone-400">|</span>
                              <span className="text-[10px] text-stone-500">{order.items_count || 0} item{(order.items_count || 0) !== 1 ? "s" : ""}</span>
                              <span className="text-[10px] text-stone-400">|</span>
                              <span className="text-[10px] font-medium text-stone-700">${Number(order.total_amount || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[order.status] || "bg-stone-100 text-stone-600")}>
                            {order.status}
                          </span>
                          {order.status === "Unshipped" && (
                            <button
                              onClick={() => { setSelectedOrder(order); setShowLabelModal(true); setLabelRates([]) }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors"
                            >
                              <Printer className="w-3 h-3" /> Print Label
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Label Modal */}
        {showLabelModal && selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">Create Shipping Label</h3>
                  <p className="text-xs text-stone-500 font-mono">{selectedOrder.amazon_order_id}</p>
                </div>
                <button onClick={() => setShowLabelModal(false)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-stone-700 mb-2 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Ship From (Your Address)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name" value={labelForm.shipFromName} onChange={(e) => setLabelForm({ ...labelForm, shipFromName: e.target.value })} className="h-8 text-xs" />
                    <Input placeholder="Address" value={labelForm.shipFromAddress} onChange={(e) => setLabelForm({ ...labelForm, shipFromAddress: e.target.value })} className="h-8 text-xs" />
                    <Input placeholder="City" value={labelForm.shipFromCity} onChange={(e) => setLabelForm({ ...labelForm, shipFromCity: e.target.value })} className="h-8 text-xs" />
                    <div className="flex gap-2">
                      <Input placeholder="State" value={labelForm.shipFromState} onChange={(e) => setLabelForm({ ...labelForm, shipFromState: e.target.value })} className="h-8 text-xs flex-1" />
                      <Input placeholder="ZIP" value={labelForm.shipFromZip} onChange={(e) => setLabelForm({ ...labelForm, shipFromZip: e.target.value })} className="h-8 text-xs w-20" />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-stone-700 mb-2 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Ship To (From Order)</h4>
                  <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600 space-y-0.5">
                    <p className="font-medium text-stone-800">{selectedOrder.raw_data?.ShippingAddress?.Name || "Address from order"}</p>
                    <p>{selectedOrder.raw_data?.ShippingAddress?.AddressLine1 || ""}</p>
                    <p>
                      {selectedOrder.raw_data?.ShippingAddress?.City || ""}{", "}
                      {selectedOrder.raw_data?.ShippingAddress?.StateOrRegion || ""}{" "}
                      {selectedOrder.raw_data?.ShippingAddress?.PostalCode || ""}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-stone-700 mb-2 flex items-center gap-1.5"><Tag className="w-3 h-3" /> Package Details</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div><label className="text-[10px] text-stone-500">Weight (lb)</label><Input value={labelForm.weightValue} onChange={(e) => setLabelForm({ ...labelForm, weightValue: e.target.value })} className="h-8 text-xs" /></div>
                    <div><label className="text-[10px] text-stone-500">L (cm)</label><Input value={labelForm.lengthCm} onChange={(e) => setLabelForm({ ...labelForm, lengthCm: e.target.value })} className="h-8 text-xs" /></div>
                    <div><label className="text-[10px] text-stone-500">W (cm)</label><Input value={labelForm.widthCm} onChange={(e) => setLabelForm({ ...labelForm, widthCm: e.target.value })} className="h-8 text-xs" /></div>
                    <div><label className="text-[10px] text-stone-500">H (cm)</label><Input value={labelForm.heightCm} onChange={(e) => setLabelForm({ ...labelForm, heightCm: e.target.value })} className="h-8 text-xs" /></div>
                  </div>
                </div>

                <Button onClick={handleGetRates} disabled={labelLoading} className="w-full gap-2">
                  {labelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  {labelLoading ? "Getting Rates..." : "Get Shipping Rates"}
                </Button>

                {labelRates.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-stone-700">Available Rates</h4>
                    {labelRates.map((rate: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors">
                        <div>
                          <p className="text-xs font-medium text-stone-900">{rate.serviceName || rate.serviceType || "Shipping"}</p>
                          <p className="text-[10px] text-stone-500">{rate.promise?.deliveryWindow?.start ? `Est: ${new Date(rate.promise.deliveryWindow.start).toLocaleDateString()}` : "Standard"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-stone-900">${Number(rate.totalCharge?.value || 0).toFixed(2)}</span>
                          <Button size="sm" className="text-xs gap-1" onClick={() => handlePurchaseLabel(rate.serviceId || rate.rateId || "")}>
                            <Printer className="w-3 h-3" /> Buy
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {labelRates.length === 0 && !labelLoading && (
                  <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Fill in your ship-from address and package details, then click Get Shipping Rates
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <MobileNav />
      </div>
    </div>
  )
}
