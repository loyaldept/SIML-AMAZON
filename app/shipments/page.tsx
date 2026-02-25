"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Truck, Package, Bell, Plus, RefreshCw, Loader2, MapPin, Printer, Search, AlertCircle, X, ChevronRight, ArrowRight, Box, ClipboardList } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface InboundShipment {
  ShipmentId: string
  ShipmentName: string
  ShipmentStatus: string
  DestinationFulfillmentCenterId: string
  ShipFromAddress?: any
  LabelPrepType?: string
}

interface ShipmentItem {
  SellerSKU: string
  QuantityShipped: number
  QuantityReceived?: number
  QuantityInCase?: number
  FulfillmentNetworkSKU?: string
}

interface InventoryItem {
  id: string
  asin: string
  sku: string
  title: string
  quantity: number
  fnsku?: string
  image_url?: string
}

type CreateStep = "items" | "address" | "plan" | "confirm"

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<InboundShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [amazonConnected, setAmazonConnected] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [error, setError] = useState("")

  // Shipment details
  const [selectedShipment, setSelectedShipment] = useState<InboundShipment | null>(null)
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  // Create new shipment
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>("items")
  const [createLoading, setCreateLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Map<string, { sku: string; asin: string; title: string; qty: number }>>(new Map())
  const [shipFrom, setShipFrom] = useState({
    Name: "", AddressLine1: "", City: "", StateOrProvinceCode: "", PostalCode: "", CountryCode: "US",
  })
  const [planResult, setPlanResult] = useState<any>(null)

  // Labels
  const [labelLoading, setLabelLoading] = useState(false)

  // Status update & transport
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [transportInfo, setTransportInfo] = useState<any>(null)
  const [transportLoading, setTransportLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: conn } = await supabase
      .from("channel_connections").select("status")
      .eq("user_id", user.id).eq("channel", "Amazon").single()

    const connected = conn?.status === "connected"
    setAmazonConnected(connected)

    if (connected) {
      try {
        const res = await fetch("/api/amazon/fulfillment")
        if (res.ok) {
          const data = await res.json()
          setShipments(data.shipments || [])
        }
      } catch (e: any) {
        setError(e.message)
      }

      // Load inventory for create shipment flow
      const { data: inv } = await supabase.from("inventory").select("*").eq("user_id", user.id).order("title")
      if (inv) setInventory(inv)
    }
    setLoading(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/amazon/fulfillment")
      if (res.ok) {
        const data = await res.json()
        setShipments(data.shipments || [])
      }
    } catch (e: any) {
      setError(e.message)
    }
    setSyncing(false)
  }

  const loadShipmentItems = async (shipment: InboundShipment) => {
    setSelectedShipment(shipment)
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/amazon/fulfillment?shipmentId=${shipment.ShipmentId}`)
      if (res.ok) {
        const data = await res.json()
        setShipmentItems(data?.payload?.ItemData || [])
      }
    } catch (e) {
      console.log("Error loading items:", e)
    }
    setLoadingItems(false)
  }

  const handleCreatePlan = async () => {
    if (selectedItems.size === 0) return
    setCreateLoading(true)
    setError("")

    const items = Array.from(selectedItems.values()).map(item => ({
      SellerSKU: item.sku,
      ASIN: item.asin,
      Quantity: item.qty,
      Condition: "NewItem",
    }))

    try {
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createPlan",
          shipFromAddress: shipFrom,
          items,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create plan")

      setPlanResult(data)
      setCreateStep("plan")
    } catch (e: any) {
      setError(e.message)
    }
    setCreateLoading(false)
  }

  const handleConfirmShipment = async (plan: any) => {
    setCreateLoading(true)
    setError("")

    try {
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createShipment",
          shipmentId: plan.ShipmentId,
          header: {
            ShipmentName: `Shipment ${new Date().toLocaleDateString()}`,
            ShipFromAddress: shipFrom,
            DestinationFulfillmentCenterId: plan.DestinationFulfillmentCenterId,
            LabelPrepPreference: "SELLER_LABEL",
            ShipmentStatus: "WORKING",
          },
          items: plan.Items?.map((item: any) => ({
            SellerSKU: item.SellerSKU,
            QuantityShipped: item.Quantity,
          })) || [],
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create shipment")

      setShowCreate(false)
      setCreateStep("items")
      setSelectedItems(new Map())
      setPlanResult(null)
      await loadData()
    } catch (e: any) {
      setError(e.message)
    }
    setCreateLoading(false)
  }

  const handlePrintLabels = async (shipmentId: string) => {
    setLabelLoading(true)
    setError("")
    try {
      // Try SP-API labels (for shipments that have items)
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getLabels",
          shipmentId,
          pageType: "PackageLabel_Plain_Paper",
          labelType: "UNIQUE",
        }),
      })

      const data = await res.json()

      if (data.error) {
        // SP-API labels failed - fall back to local FNSKU label generation
        if (shipmentItems.length > 0) {
          const labelRes = await fetch("/api/amazon/labels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: shipmentItems.map(si => ({
                sku: si.SellerSKU,
                fnsku: si.FulfillmentNetworkSKU || si.SellerSKU,
                title: si.SellerSKU,
                condition: "New",
              })),
              pageType: "PackageLabel_Plain_Paper",
            }),
          })
          const labelData = await labelRes.json()
          if (labelData.html) {
            const blob = new Blob([labelData.html], { type: "text/html" })
            const url = URL.createObjectURL(blob)
            const w = window.open(url, "_blank")
            if (!w) {
              // Fallback: hidden iframe print
              const iframe = document.createElement("iframe")
              iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
              document.body.appendChild(iframe)
              const doc = iframe.contentDocument || iframe.contentWindow?.document
              if (doc) { doc.open(); doc.write(labelData.html); doc.close() }
              setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000) }, 500)
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000)
          } else {
            setError("Could not generate labels. Try clicking 'Details' first to load items.")
          }
        } else {
          setError("Click 'Details' on the shipment first to load items, then try printing labels again.")
        }
        setLabelLoading(false)
        return
      }

      const pdfUrl = data?.payload?.DownloadURL || data?.DownloadURL
      if (pdfUrl) {
        window.open(pdfUrl, "_blank")
      } else {
        setError("No label URL from Amazon. Click 'Details' first, then try again.")
      }
    } catch (e: any) {
      setError(e.message || "Failed to print labels")
    }
    setLabelLoading(false)
  }

  const handleUpdateShipmentStatus = async (shipment: InboundShipment, newStatus: string) => {
    setStatusUpdating(true)
    setError("")
    try {
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStatus",
          shipmentId: shipment.ShipmentId,
          header: {
            ShipmentName: shipment.ShipmentName,
            ShipFromAddress: shipment.ShipFromAddress || { Name: "", AddressLine1: "", City: "", StateOrProvinceCode: "", PostalCode: "", CountryCode: "US" },
            DestinationFulfillmentCenterId: shipment.DestinationFulfillmentCenterId,
            LabelPrepPreference: shipment.LabelPrepType || "SELLER_LABEL",
            ShipmentStatus: newStatus,
          },
          items: shipmentItems.map(item => ({
            SellerSKU: item.SellerSKU,
            QuantityShipped: item.QuantityShipped,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update status")
      }

      // Refresh shipments list
      await handleSync()
      // Update local state
      if (selectedShipment) {
        setSelectedShipment({ ...selectedShipment, ShipmentStatus: newStatus })
      }
    } catch (e: any) {
      setError(e.message)
    }
    setStatusUpdating(false)
  }

  const handleGetTransport = async (shipmentId: string) => {
    setTransportLoading(true)
    setTransportInfo(null)
    try {
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getTransport", shipmentId }),
      })
      if (res.ok) {
        const data = await res.json()
        setTransportInfo(data?.payload?.TransportContent || data)
      }
    } catch (e: any) {
      setError(e.message || "Failed to get transport info")
    }
    setTransportLoading(false)
  }

  const handleConfirmTransport = async (shipmentId: string) => {
    setTransportLoading(true)
    setError("")
    try {
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmTransport", shipmentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to confirm transport")
      }
    } catch (e: any) {
      setError(e.message)
    }
    setTransportLoading(false)
  }

  const handleVoidTransport = async (shipmentId: string) => {
    setTransportLoading(true)
    setError("")
    try {
      const res = await fetch("/api/amazon/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "voidTransport", shipmentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to void transport")
      }
      setTransportInfo(null)
    } catch (e: any) {
      setError(e.message)
    }
    setTransportLoading(false)
  }

  const statusColors: Record<string, string> = {
    WORKING: "bg-amber-100 text-amber-700",
    SHIPPED: "bg-blue-100 text-blue-700",
    RECEIVING: "bg-purple-100 text-purple-700",
    CLOSED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
    DELETED: "bg-stone-100 text-stone-600",
    IN_TRANSIT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    CHECKED_IN: "bg-purple-100 text-purple-700",
  }

  const filtered = shipments.filter((s) => {
    const matchSearch = !searchQuery || s.ShipmentId?.toLowerCase().includes(searchQuery.toLowerCase()) || s.ShipmentName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchFilter = filterStatus === "all" || s.ShipmentStatus === filterStatus
    return matchSearch && matchFilter
  })

  const toggleItem = (item: InventoryItem) => {
    setSelectedItems(prev => {
      const next = new Map(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.set(item.id, { sku: item.sku, asin: item.asin, title: item.title, qty: item.quantity || 1 })
      }
      return next
    })
  }

  const updateItemQty = (id: string, qty: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev)
      const existing = next.get(id)
      if (existing) {
        next.set(id, { ...existing, qty: Math.max(1, qty) })
      }
      return next
    })
  }

  return (
    <div className="flex h-screen bg-[#FBFBF9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-14 border-b border-stone-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-stone-400" />
            <h1 className="text-base font-semibold text-stone-900">Inbound Shipments</h1>
          </div>
          <div className="flex items-center gap-2">
            {amazonConnected && !showCreate && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 bg-transparent text-xs" onClick={() => { setShowCreate(true); setCreateStep("items") }}>
                  <Plus className="w-3.5 h-3.5" />
                  New Shipment
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 bg-transparent text-xs" onClick={handleSync} disabled={syncing}>
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {syncing ? "Syncing..." : "Sync"}
                </Button>
              </>
            )}
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {error && (
          <div className="mx-4 md:mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-24">
          <div className="max-w-4xl mx-auto">

            {/* Create New Shipment Flow */}
            {showCreate && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-900">Create Inbound Shipment</h2>
                  <button onClick={() => { setShowCreate(false); setCreateStep("items"); setSelectedItems(new Map()); setPlanResult(null) }} className="text-xs text-stone-500 hover:text-stone-700">Cancel</button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 text-[10px] font-medium">
                  {(["items", "address", "plan"] as const).map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      {i > 0 && <ChevronRight className="w-3 h-3 text-stone-300" />}
                      <span className={cn(
                        "px-2.5 py-1 rounded-md",
                        createStep === step ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
                      )}>
                        {step === "items" ? "1. Select Items" : step === "address" ? "2. Ship From" : "3. Review Plan"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Step 1: Select items from inventory */}
                {createStep === "items" && (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                      <h3 className="text-xs font-medium text-stone-900">Select products to send to FBA</h3>
                      <span className="text-[10px] text-stone-500">{selectedItems.size} selected</span>
                    </div>
                    {inventory.length === 0 ? (
                      <div className="p-8 text-center">
                        <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                        <p className="text-xs text-stone-500">No inventory items found. Add products via the List page first.</p>
                        <Link href="/list"><Button size="sm" className="mt-3 text-xs">Go to List</Button></Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
                        {inventory.map(item => {
                          const isSelected = selectedItems.has(item.id)
                          const selected = selectedItems.get(item.id)
                          return (
                            <div key={item.id} className={cn("px-5 py-2.5 flex items-center gap-3 transition-colors", isSelected ? "bg-stone-50" : "hover:bg-stone-50/50")}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItem(item)}
                                className="w-3.5 h-3.5 rounded border-stone-300 accent-stone-900"
                              />
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover bg-stone-100 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-stone-100 flex items-center justify-center shrink-0 text-[10px] font-semibold text-stone-400">{item.title?.[0]}</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-stone-900 truncate">{item.title}</p>
                                <p className="text-[10px] text-stone-500">SKU: {item.sku} &middot; ASIN: {item.asin}</p>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <label className="text-[10px] text-stone-500">Qty:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={selected?.qty || 1}
                                    onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 1)}
                                    className="w-14 h-7 text-xs text-center border border-stone-200 rounded bg-white"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="px-5 py-3 border-t border-stone-100">
                      <Button
                        onClick={() => setCreateStep("address")}
                        disabled={selectedItems.size === 0}
                        className="w-full gap-2 text-xs"
                      >
                        Continue <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Ship-from address */}
                {createStep === "address" && (
                  <div className="bg-white rounded-xl border border-stone-200 p-5">
                    <h3 className="text-xs font-medium text-stone-900 mb-3 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Ship From Address</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Business / Contact Name" value={shipFrom.Name} onChange={(e) => setShipFrom({ ...shipFrom, Name: e.target.value })} className="h-9 text-xs" />
                      <Input placeholder="Address Line 1" value={shipFrom.AddressLine1} onChange={(e) => setShipFrom({ ...shipFrom, AddressLine1: e.target.value })} className="h-9 text-xs" />
                      <Input placeholder="City" value={shipFrom.City} onChange={(e) => setShipFrom({ ...shipFrom, City: e.target.value })} className="h-9 text-xs" />
                      <div className="flex gap-2">
                        <Input placeholder="State" value={shipFrom.StateOrProvinceCode} onChange={(e) => setShipFrom({ ...shipFrom, StateOrProvinceCode: e.target.value })} className="h-9 text-xs flex-1" />
                        <Input placeholder="ZIP" value={shipFrom.PostalCode} onChange={(e) => setShipFrom({ ...shipFrom, PostalCode: e.target.value })} className="h-9 text-xs w-24" />
                      </div>
                    </div>

                    <div className="mt-4 bg-stone-50 rounded-lg p-3">
                      <h4 className="text-[10px] font-medium text-stone-700 mb-2">Items to ship ({selectedItems.size})</h4>
                      {Array.from(selectedItems.entries()).map(([id, item]) => (
                        <div key={id} className="flex items-center justify-between py-1">
                          <span className="text-[10px] text-stone-600 truncate flex-1">{item.title}</span>
                          <span className="text-[10px] font-medium text-stone-900 ml-2">{item.qty} units</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" onClick={() => setCreateStep("items")} className="flex-1 text-xs">Back</Button>
                      <Button
                        onClick={handleCreatePlan}
                        disabled={createLoading || !shipFrom.Name || !shipFrom.AddressLine1 || !shipFrom.City || !shipFrom.StateOrProvinceCode || !shipFrom.PostalCode}
                        className="flex-1 gap-2 text-xs"
                      >
                        {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                        {createLoading ? "Creating Plan..." : "Create Shipment Plan"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Review plan from Amazon */}
                {createStep === "plan" && planResult && (
                  <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
                    <h3 className="text-xs font-medium text-stone-900">Amazon Shipment Plan</h3>
                    <p className="text-[10px] text-stone-500">Amazon has determined where your items should be sent. Review and confirm to create the shipment.</p>

                    {(planResult?.payload?.InboundShipmentPlans || []).map((plan: any, i: number) => (
                      <div key={i} className="border border-stone-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs font-medium text-stone-900">{plan.ShipmentId}</p>
                            <p className="text-[10px] text-stone-500">Destination: {plan.DestinationFulfillmentCenterId}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Ready</span>
                        </div>
                        <div className="space-y-1 mt-2">
                          {plan.Items?.map((item: any, j: number) => (
                            <div key={j} className="flex items-center justify-between text-[10px]">
                              <span className="text-stone-600">{item.SellerSKU}</span>
                              <span className="font-medium text-stone-900">{item.Quantity} units</span>
                            </div>
                          ))}
                        </div>
                        <Button onClick={() => handleConfirmShipment(plan)} disabled={createLoading} className="w-full mt-3 gap-2 text-xs">
                          {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                          {createLoading ? "Creating..." : "Confirm & Create Shipment"}
                        </Button>
                      </div>
                    ))}

                    {(!planResult?.payload?.InboundShipmentPlans || planResult.payload.InboundShipmentPlans.length === 0) && (
                      <div className="text-center py-4">
                        <p className="text-xs text-stone-500">No shipment plans returned. Check your items and address.</p>
                        <pre className="mt-2 text-[10px] text-stone-400 bg-stone-50 rounded p-2 overflow-auto max-h-32">{JSON.stringify(planResult, null, 2)}</pre>
                      </div>
                    )}

                    <Button variant="outline" onClick={() => setCreateStep("address")} className="w-full text-xs">Back to Address</Button>
                  </div>
                )}
              </div>
            )}

            {/* Main Content */}
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
                <h2 className="text-lg font-semibold text-stone-900 mb-2">Connect Amazon to manage inbound shipments</h2>
                <p className="text-sm text-stone-500 mb-6 max-w-sm">
                  Connect your Amazon Seller account to create FBA inbound shipments, print labels, and send inventory to Amazon fulfillment centers.
                </p>
                <Link href="/settings">
                  <Button className="gap-2"><Plus className="w-4 h-4" />Connect Amazon</Button>
                </Link>
              </div>
            ) : !showCreate && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total Shipments", value: shipments.length },
                    { label: "Working", value: shipments.filter(s => s.ShipmentStatus === "WORKING").length },
                    { label: "Shipped", value: shipments.filter(s => s.ShipmentStatus === "SHIPPED" || s.ShipmentStatus === "IN_TRANSIT").length },
                    { label: "Receiving", value: shipments.filter(s => s.ShipmentStatus === "RECEIVING" || s.ShipmentStatus === "CHECKED_IN").length },
                  ].map((s) => (
                    <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-4">
                      <div className="text-2xl font-semibold text-stone-900">{s.value}</div>
                      <div className="text-xs text-stone-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by shipment ID or name..." className="pl-10 h-9 text-sm" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {["all", "WORKING", "SHIPPED", "RECEIVING", "CLOSED"].map((s) => (
                      <button key={s} onClick={() => setFilterStatus(s)} className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        filterStatus === s ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                      )}>
                        {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shipments list */}
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
                      <Box className="w-8 h-8 text-stone-300" />
                    </div>
                    <h2 className="text-lg font-semibold text-stone-900 mb-2">No inbound shipments yet</h2>
                    <p className="text-sm text-stone-500 mb-6 max-w-sm">
                      Create your first FBA inbound shipment to send inventory to Amazon fulfillment centers.
                    </p>
                    <Button className="gap-2" onClick={() => { setShowCreate(true); setCreateStep("items") }}>
                      <Plus className="w-4 h-4" />
                      Create Shipment
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-stone-100">
                      <h3 className="text-sm font-medium text-stone-900">{filtered.length} Shipment{filtered.length !== 1 ? "s" : ""}</h3>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {filtered.map((shipment) => (
                        <div key={shipment.ShipmentId} className="px-5 py-3 hover:bg-stone-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                <Box className="w-4 h-4 text-stone-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-stone-900 font-mono truncate">{shipment.ShipmentId}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-stone-500">{shipment.ShipmentName || "Unnamed"}</span>
                                  <span className="text-[10px] text-stone-400">|</span>
                                  <span className="text-[10px] text-stone-500">Dest: {shipment.DestinationFulfillmentCenterId || "TBD"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[shipment.ShipmentStatus] || "bg-stone-100 text-stone-600")}>
                                {shipment.ShipmentStatus}
                              </span>
                              <button
                                onClick={() => loadShipmentItems(shipment)}
                                className="text-[10px] px-2 py-1 rounded-md text-stone-600 hover:bg-stone-100 transition-colors"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => handlePrintLabels(shipment.ShipmentId)}
                                disabled={labelLoading}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors"
                              >
                                <Printer className="w-3 h-3" /> Labels
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipment Detail Modal */}
                {selectedShipment && (
                  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
                      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                        <div>
                          <h3 className="text-sm font-semibold text-stone-900">Shipment Details</h3>
                          <p className="text-xs text-stone-500 font-mono">{selectedShipment.ShipmentId}</p>
                        </div>
                        <button onClick={() => { setSelectedShipment(null); setShipmentItems([]) }} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="px-6 py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-stone-500">Name</span>
                            <p className="font-medium text-stone-900">{selectedShipment.ShipmentName || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-stone-500">Status</span>
                            <p className="font-medium text-stone-900">{selectedShipment.ShipmentStatus}</p>
                          </div>
                          <div>
                            <span className="text-stone-500">Destination</span>
                            <p className="font-medium text-stone-900">{selectedShipment.DestinationFulfillmentCenterId || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-stone-500">Label Prep</span>
                            <p className="font-medium text-stone-900">{selectedShipment.LabelPrepType || "SELLER_LABEL"}</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-stone-700 mb-2">Shipment Items</h4>
                          {loadingItems ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                            </div>
                          ) : shipmentItems.length === 0 ? (
                            <p className="text-[10px] text-stone-500 py-3">No items found in this shipment.</p>
                          ) : (
                            <div className="space-y-2">
                              {shipmentItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50">
                                  <div>
                                    <p className="text-xs font-medium text-stone-900">{item.SellerSKU}</p>
                                    {item.FulfillmentNetworkSKU && (
                                      <p className="text-[10px] text-stone-500">FNSKU: {item.FulfillmentNetworkSKU}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-medium text-stone-900">{item.QuantityShipped} shipped</p>
                                    {item.QuantityReceived !== undefined && (
                                      <p className="text-[10px] text-stone-500">{item.QuantityReceived} received</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Status Update */}
                        {(selectedShipment.ShipmentStatus === "WORKING" || selectedShipment.ShipmentStatus === "SHIPPED") && (
                          <div>
                            <h4 className="text-xs font-medium text-stone-700 mb-2">Update Status</h4>
                            <div className="flex gap-2">
                              {selectedShipment.ShipmentStatus === "WORKING" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateShipmentStatus(selectedShipment, "SHIPPED")}
                                  disabled={statusUpdating || shipmentItems.length === 0}
                                  className="flex-1 gap-1.5 text-xs"
                                >
                                  {statusUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                                  Mark as Shipped
                                </Button>
                              )}
                            </div>
                            {shipmentItems.length === 0 && (
                              <p className="text-[10px] text-stone-400 mt-1">Load items first via Details to update status</p>
                            )}
                          </div>
                        )}

                        {/* Transport Actions */}
                        <div>
                          <h4 className="text-xs font-medium text-stone-700 mb-2">Transport</h4>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGetTransport(selectedShipment.ShipmentId)}
                              disabled={transportLoading}
                              className="gap-1.5 text-xs"
                            >
                              {transportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />}
                              Transport Info
                            </Button>
                            {transportInfo && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleConfirmTransport(selectedShipment.ShipmentId)}
                                  disabled={transportLoading}
                                  className="gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                >
                                  Confirm Transport
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleVoidTransport(selectedShipment.ShipmentId)}
                                  disabled={transportLoading}
                                  className="gap-1.5 text-xs text-red-700 border-red-200 hover:bg-red-50"
                                >
                                  Void Transport
                                </Button>
                              </>
                            )}
                          </div>
                          {transportInfo && (
                            <div className="mt-2 bg-stone-50 rounded-lg p-2.5 text-[10px] text-stone-600">
                              <p><span className="font-medium">Status:</span> {transportInfo.TransportResult?.TransportStatus || "N/A"}</p>
                              {transportInfo.TransportDetails?.PartneredSmallParcelData?.PartneredEstimate && (
                                <p><span className="font-medium">Est. Cost:</span> ${transportInfo.TransportDetails.PartneredSmallParcelData.PartneredEstimate.Amount?.Value || "N/A"}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handlePrintLabels(selectedShipment.ShipmentId)}
                            disabled={labelLoading}
                            className="flex-1 gap-2 text-xs"
                          >
                            {labelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                            Print Labels
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <MobileNav />
      </div>
    </div>
  )
}
