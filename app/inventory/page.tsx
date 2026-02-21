"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { Package, Search, Bell, Menu, RefreshCw, AlertTriangle, Download, Upload, ChevronDown, MoreHorizontal, ArrowUpDown, Loader2, Printer } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { storage } from "@/lib/storage"
import type { InventoryItem } from "@/lib/types"
import { cn } from "@/lib/utils"

type FilterType = "all" | "active" | "out_of_stock" | "inactive"
type ChannelFilter = "all" | "FBA" | "FBM" | "Amazon" | "eBay"
type SortField = "title" | "price" | "quantity" | "status"
type SortDir = "asc" | "desc"

function InventoryContent() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<FilterType>("all")
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all")
  const [sortField, setSortField] = useState<SortField>("quantity")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    loadInventory()
  }, [])

  const handleSyncAmazon = async () => {
    setSyncing(true)
    try {
      await fetch("/api/amazon/inventory")
      await loadInventoryFromDb()
    } catch {
      // Not connected or failed
    }
    setSyncing(false)
  }

  const loadInventoryFromDb = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from("inventory").select("*").eq("user_id", user.id).order("updated_at", { ascending: false })
    if (data && data.length > 0) {
      const items = data.map((item: any) => ({
        id: item.id,
        sku: item.sku,
        asin: item.asin,
        title: item.title,
        imageUrl: item.image_url || "",
        quantity: item.quantity,
        price: Number(item.price || 0),
        cost: Number(item.cost || 0),
        channel: item.channel || "FBA",
        status: item.status,
        lastUpdated: new Date(item.updated_at),
      }))
      setInventory(items)
      setTotalValue(items.reduce((sum: number, i: InventoryItem) => sum + (i.price * i.quantity), 0))
    }
  }

  const loadInventory = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: conn } = await supabase
        .from("channel_connections")
        .select("status")
        .eq("user_id", user.id)
        .eq("channel", "Amazon")
        .eq("status", "connected")
        .single()

      setIsConnected(!!conn)

      const { data } = await supabase.from("inventory").select("*").eq("user_id", user.id).order("updated_at", { ascending: false })
      if (data && data.length > 0) {
        const items = data.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          asin: item.asin,
          title: item.title,
          imageUrl: item.image_url || "",
          quantity: item.quantity,
          price: Number(item.price || 0),
          cost: Number(item.cost || 0),
          channel: item.channel || "FBA",
          status: item.status,
          lastUpdated: new Date(item.updated_at),
        }))
        setInventory(items)
        setTotalValue(items.reduce((sum: number, i: InventoryItem) => sum + (i.price * i.quantity), 0))

        // If Amazon is connected and many items have $0 price, auto-sync prices in background
        if (conn) {
          const zeroPriceCount = items.filter((i: InventoryItem) => i.price === 0).length
          if (zeroPriceCount > items.length * 0.3) {
            // More than 30% items missing price - trigger background sync
            fetch("/api/amazon/inventory").then(() => loadInventoryFromDb()).catch(() => {})
          }
        }
        setLoading(false)
        return
      }

      // If Amazon is connected but no inventory yet, auto-sync
      if (conn) {
        setSyncing(true)
        try {
          await fetch("/api/amazon/inventory")
          await loadInventoryFromDb()
        } catch {
          setInventory([])
        }
        setSyncing(false)
        setLoading(false)
        return
      }
    }
    // Only show sample data for users with no Amazon connection (demo mode)
    setInventory(storage.getInventory())
    setLoading(false)
  }

  const filteredInventory = inventory
    .filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.asin.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesChannel = channelFilter === "all" || item.channel === channelFilter
      return matchesSearch && matchesStatus && matchesChannel
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortField === "title") return a.title.localeCompare(b.title) * dir
      if (sortField === "price") return (a.price - b.price) * dir
      if (sortField === "quantity") return (a.quantity - b.quantity) * dir
      if (sortField === "status") return a.status.localeCompare(b.status) * dir
      return 0
    })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInventory.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredInventory.map((i) => i.id)))
    }
  }

  const handlePrintLabels = async () => {
    const selectedItems = filteredInventory.filter(i => selectedIds.has(i.id))
    if (selectedItems.length === 0) return

    try {
      const res = await fetch("/api/amazon/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map(i => ({
            sku: i.sku,
            fnsku: i.sku, // Use SKU as FNSKU fallback
            title: i.title,
            condition: i.status === "active" ? "New" : "Used",
            asin: i.asin,
          })),
          pageType: "PackageLabel_Plain_Paper",
        }),
      })

      const data = await res.json()
      if (data.html) {
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write(data.html)
          printWindow.document.close()
        }
      }
    } catch (e) {
      console.log("Print labels error:", e)
    }
  }

  const statusTabs = [
    { id: "all" as FilterType, label: "All Items", count: inventory.length },
    { id: "active" as FilterType, label: "Active", count: inventory.filter((i) => i.status === "active").length },
    {
      id: "out_of_stock" as FilterType,
      label: "Out of Stock",
      count: inventory.filter((i) => i.status === "out_of_stock").length,
    },
    { id: "inactive" as FilterType, label: "Inactive", count: inventory.filter((i) => i.status === "inactive").length },
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
              Workspace / <span className="text-stone-900">Inventory</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 bg-transparent text-xs">
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 bg-transparent text-xs">
              <Upload className="w-3.5 h-3.5" />
              Import
            </Button>
            <Button variant="outline" size="sm" className="flex gap-1.5 bg-transparent text-xs" onClick={handleSyncAmazon} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync"}</span>
            </Button>
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Status Tabs - Top Edge List */}
        <div className="px-4 md:px-6 py-3 border-b border-stone-100 bg-white/50">
          <div className="flex items-center gap-2 overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  statusFilter === tab.id
                    ? "bg-stone-900 text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    statusFilter === tab.id ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-48">
          <div className="max-w-6xl mx-auto space-y-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-stone-300 animate-spin mb-4" />
                <p className="text-sm text-stone-500">{syncing ? "Syncing inventory from Amazon..." : "Loading inventory..."}</p>
              </div>
            )}

            {!loading && (
            <>
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 bg-stone-900 text-white rounded-xl px-4 py-2.5">
                <span className="text-xs font-medium">{selectedIds.size} selected</span>
                <div className="h-4 w-px bg-white/20" />
                <button className="text-xs hover:text-white/80 transition-colors">Edit Prices</button>
                <button className="text-xs hover:text-white/80 transition-colors">Change Status</button>
                <button className="text-xs hover:text-white/80 transition-colors">Export Selected</button>
                <button onClick={handlePrintLabels} className="text-xs hover:text-white/80 transition-colors flex items-center gap-1"><Printer className="w-3 h-3" />Print Labels</button>
                <button className="text-xs text-red-300 hover:text-red-200 transition-colors">Delete</button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-white/50 hover:text-white/80">Clear</button>
              </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, SKU, or ASIN..."
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                >
                  <option value="all">All Channels</option>
                  <option value="FBA">FBA</option>
                  <option value="FBM">FBM</option>
                  <option value="Amazon">Amazon</option>
                  <option value="eBay">eBay</option>
                </select>
                <button
                  onClick={() => toggleSort(sortField)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs bg-white hover:bg-stone-50 transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
                  <span className="hidden sm:inline text-stone-600">Sort</span>
                </button>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-stone-200 p-3">
                <div className="text-lg font-semibold text-stone-900">{inventory.length}</div>
                <div className="text-[10px] text-stone-500">Total SKUs</div>
              </div>
              <div className="bg-white rounded-xl border border-stone-200 p-3">
                <div className="text-lg font-semibold text-stone-900">{inventory.reduce((s, i) => s + i.quantity, 0)}</div>
                <div className="text-[10px] text-stone-500">Total Units</div>
              </div>
              <div className="bg-white rounded-xl border border-stone-200 p-3">
                <div className="text-lg font-semibold text-stone-900">${totalValue.toFixed(2)}</div>
                <div className="text-[10px] text-stone-500">Est. Value</div>
              </div>
              <div className="bg-white rounded-xl border border-stone-200 p-3">
                <div className="text-lg font-semibold text-stone-900">{inventory.filter(i => i.quantity === 0).length}</div>
                <div className="text-[10px] text-stone-500">Out of Stock</div>
              </div>
            </div>

            {/* Results count */}
            <p className="text-[10px] text-stone-400">{filteredInventory.length} products</p>

            {/* Inventory Table */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-stone-50 border-b border-stone-100 text-[10px] font-medium text-stone-500 uppercase tracking-wider items-center">
                <div className="col-span-5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredInventory.length && filteredInventory.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3 h-3 rounded border-stone-300 accent-stone-900"
                  />
                  <button onClick={() => toggleSort("title")} className="flex items-center gap-1 hover:text-stone-700">
                    Product {sortField === "title" && <span>{sortDir === "asc" ? "^" : "v"}</span>}
                  </button>
                </div>
                <div className="col-span-2">SKU</div>
                <button onClick={() => toggleSort("quantity")} className="col-span-1 text-center flex items-center justify-center gap-1 hover:text-stone-700">
                  Qty {sortField === "quantity" && <span>{sortDir === "asc" ? "^" : "v"}</span>}
                </button>
                <button onClick={() => toggleSort("price")} className="col-span-2 text-right flex items-center justify-end gap-1 hover:text-stone-700">
                  Price {sortField === "price" && <span>{sortDir === "asc" ? "^" : "v"}</span>}
                </button>
                <button onClick={() => toggleSort("status")} className="col-span-2 text-right flex items-center justify-end gap-1 hover:text-stone-700">
                  Status {sortField === "status" && <span>{sortDir === "asc" ? "^" : "v"}</span>}
                </button>
              </div>

              {/* Table Body */}
              {filteredInventory.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5 text-stone-400" />
                  </div>
                  <p className="text-stone-500 text-xs">No inventory items found.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredInventory.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2 hover:bg-stone-50 transition-colors items-center"
                    >
                      {/* Product */}
                      <div className="md:col-span-5 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-3 h-3 rounded border-stone-300 accent-stone-900 shrink-0 hidden md:block"
                        />
{item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-8 h-8 rounded object-cover bg-stone-100 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-stone-100 flex items-center justify-center shrink-0 text-[10px] font-semibold text-stone-400">
                            {item.title.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-stone-900 truncate">{item.title}</div>
                          <div className="text-[10px] text-stone-500">{item.asin}</div>
                        </div>
                      </div>

                      {/* SKU */}
                      <div className="md:col-span-2">
                        <span className="md:hidden text-[10px] text-stone-500 mr-1">SKU:</span>
                        <span className="text-xs font-mono text-stone-600">{item.sku}</span>
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-1 md:text-center">
                        <span className="md:hidden text-[10px] text-stone-500 mr-1">Qty:</span>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            item.quantity === 0
                              ? "text-red-500"
                              : item.quantity < 10
                                ? "text-yellow-600"
                                : "text-stone-900",
                          )}
                        >
                          {item.quantity}
                        </span>
                        {item.quantity === 0 && (
                          <AlertTriangle className="inline-block w-2.5 h-2.5 text-red-500 ml-0.5" />
                        )}
                      </div>

                      {/* Price */}
                      <div className="md:col-span-2 md:text-right">
                        <span className="md:hidden text-[10px] text-stone-500 mr-1">Price:</span>
                        {item.price > 0 ? (
                          <span className="text-xs font-semibold text-stone-900">${item.price.toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-stone-400 italic">No price</span>
                        )}
                        {item.cost > 0 && (
                          <div className="text-[10px] text-stone-500">Cost: ${item.cost.toFixed(2)}</div>
                        )}
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2 md:text-right flex items-center justify-end gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            item.status === "active" && "bg-emerald-100 text-emerald-700",
                            item.status === "out_of_stock" && "bg-red-100 text-red-700",
                            item.status === "inactive" && "bg-stone-100 text-stone-600",
                          )}
                        >
                          {item.channel}
                          <span className="opacity-50">•</span>
                          {item.status.replace("_", " ")}
                        </span>
                        <button className="p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors hidden md:block">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}
          </div>
        </div>


      </main>

      <MobileNav />
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryContent />
    </Suspense>
  )
}
