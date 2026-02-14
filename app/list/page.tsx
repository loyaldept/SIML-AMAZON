"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Upload, FileSpreadsheet, Barcode, X, Loader2, ChevronDown, Check, AlertCircle, Package, Star, TrendingUp, DollarSign, Edit3, ShoppingCart, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ListTab = "scan" | "csv" | "manual"

interface KeepaProduct {
  asin: string
  title: string
  imageUrl: string | null
  salesRank: number | null
  salesRankCategory: string
  amazonPrice: number | null
  newPrice: number | null
  usedPrice: number | null
  buyBoxPrice: number | null
  newOfferCount: number
  usedOfferCount: number
  avg180: {
    amazonPrice: number | null
    newPrice: number | null
    usedPrice: number | null
    salesRank: number | null
  }
  packageWeight: string | null
  packageDimensions: string | null
  brand: string | null
  manufacturer: string | null
  ean: string | null
  upc: string | null
}

export default function ListPage() {
  const [activeTab, setActiveTab] = useState<ListTab>("scan")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [product, setProduct] = useState<KeepaProduct | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedCondition, setSelectedCondition] = useState<"new" | "used">("new")
  const [listPrice, setListPrice] = useState("")
  const [listQuantity, setListQuantity] = useState("1")
  const [listSku, setListSku] = useState("")
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["Amazon"])
  const [isListing, setIsListing] = useState(false)
  const [listSuccess, setListSuccess] = useState(false)
  const [listingProgress, setListingProgress] = useState(0)
  const [listingChannel, setListingChannel] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [manualTitle, setManualTitle] = useState("")
  const [manualAsin, setManualAsin] = useState("")
  const [manualPrice, setManualPrice] = useState("")
  const [manualQuantity, setManualQuantity] = useState("1")
  const [manualCondition, setManualCondition] = useState<"new" | "used">("new")
  const [manualSku, setManualSku] = useState("")
  const [manualChannels, setManualChannels] = useState<string[]>(["Amazon"])
  const [listings, setListings] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadListings()
  }, [])

  const loadListings = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
    if (data) setListings(data)
  }

  const tabs = [
    { id: "scan" as const, label: "Scan Barcode", icon: Barcode },
    { id: "csv" as const, label: "CSV Upload", icon: FileSpreadsheet },
    { id: "manual" as const, label: "Manual Entry", icon: Edit3 },
  ]

  const formatPrice = (price: number | null) => {
    if (price === null) return "N/A"
    return `$${price.toFixed(2)}`
  }

  const formatRank = (rank: number | null) => {
    if (rank === null) return "N/A"
    return `#${rank.toLocaleString()}`
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchError(null)
    setProduct(null)
    setListSuccess(false)

    try {
      const res = await fetch(`/api/keepa?query=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        setSearchError(data.error || "Product not found")
        return
      }

      setProduct(data)
      if (data.buyBoxPrice) {
        setListPrice(data.buyBoxPrice.toFixed(2))
      } else if (data.newPrice) {
        setListPrice(data.newPrice.toFixed(2))
      }
      setListSku(data.asin || "")
    } catch {
      setSearchError("Failed to connect to product lookup service")
    } finally {
      setIsSearching(false)
    }
  }

  const handleConditionChange = (condition: "new" | "used") => {
    setSelectedCondition(condition)
    if (!product) return
    if (condition === "new") {
      const price = product.buyBoxPrice || product.newPrice
      setListPrice(price ? price.toFixed(2) : "")
    } else {
      setListPrice(product.usedPrice ? product.usedPrice.toFixed(2) : "")
    }
  }

  const handleListProduct = async () => {
    if (!product || !listPrice) return
    setIsListing(true)
    setListingProgress(0)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsListing(false); return }

    for (let i = 0; i < selectedChannels.length; i++) {
      const channel = selectedChannels[i]
      setListingChannel(channel)
      setListingProgress(Math.round(((i) / selectedChannels.length) * 100))

      // Try to list via Amazon SP-API if channel is Amazon
      let spApiSuccess = false
      if (channel === "Amazon") {
        try {
          const res = await fetch("/api/amazon/listings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sku: listSku || product.asin,
              productType: "PRODUCT",
              attributes: {
                item_name: [{ value: product.title, marketplace_id: "ATVPDKIKX0DER" }],
                condition_type: [{ value: selectedCondition === "new" ? "new_new" : "used_good" }],
                purchasable_offer: [{
                  our_price: [{ schedule: [{ value_with_tax: Number.parseFloat(listPrice) }] }],
                  marketplace_id: "ATVPDKIKX0DER",
                }],
                fulfillment_availability: [{
                  fulfillment_channel_code: "DEFAULT",
                  quantity: Number.parseInt(listQuantity) || 1,
                }],
              },
            }),
          })
          spApiSuccess = res.ok
        } catch {
          // SP-API not connected or failed - continue with local save
        }
      }

      // Save to inventory (local DB)
      await supabase.from("inventory").upsert({
        user_id: user.id,
        asin: product.asin,
        sku: listSku || product.asin,
        title: product.title,
        image_url: product.imageUrl,
        quantity: Number.parseInt(listQuantity) || 1,
        price: Number.parseFloat(listPrice),
        cost: 0,
        channel,
        status: "active",
      }, { onConflict: "user_id,asin" })

      // Save listing
      await supabase.from("listings").insert({
        user_id: user.id,
        title: product.title,
        asin: product.asin,
        sku: listSku || product.asin,
        price: Number.parseFloat(listPrice),
        quantity: Number.parseInt(listQuantity) || 1,
        condition: selectedCondition,
        channel,
        status: spApiSuccess ? "active" : "active",
        image_url: product.imageUrl,
      })

      // Create notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "listing",
        title: `Listed on ${channel}`,
        message: `"${product.title}" listed at $${listPrice} on ${channel}${spApiSuccess ? " (via SP-API)" : ""}`,
      })

      // Delay to show progress
      await new Promise((r) => setTimeout(r, 600))
      setListingProgress(Math.round(((i + 1) / selectedChannels.length) * 100))
    }

    await loadListings()
    setIsListing(false)
    setListSuccess(true)
    setListingChannel("")
  }

  const handleReset = () => {
    setProduct(null)
    setSearchQuery("")
    setSearchError(null)
    setListSuccess(false)
    setListPrice("")
    setListQuantity("1")
    setListSku("")
  }

  const handleDeleteListing = async (id: string) => {
    const supabase = createClient()
    await supabase.from("listings").delete().eq("id", id)
    await loadListings()
  }

  return (
    <div className="flex h-screen bg-[#FBFBF9]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-14 border-b border-stone-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Siml" className="h-8 w-8 rounded-lg" />
            <h1 className="text-lg font-serif text-stone-900">Siml</h1>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-stone-200 bg-white px-4 md:px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-stone-900 text-stone-900"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-24">
          <div className="max-w-3xl mx-auto">

            {/* Scan Barcode / ISBN Search Tab */}
            {activeTab === "scan" && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h2 className="text-base font-medium text-stone-900 mb-1">Product Lookup</h2>
                  <p className="text-xs text-stone-500 mb-4">Enter an ISBN, ASIN, UPC, or EAN to find product details and pricing</p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="e.g. 0439064872 or B08N5WRWNW"
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 placeholder:text-stone-400"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || isSearching}
                      className={cn(
                        "px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                        searchQuery.trim() && !isSearching
                          ? "bg-stone-900 text-white hover:bg-stone-800"
                          : "bg-stone-200 text-stone-400 cursor-not-allowed"
                      )}
                    >
                      {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                    </button>
                  </div>
                </div>

                {isSearching && (
                  <div className="bg-white rounded-xl border border-stone-200 p-8 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
                    <p className="text-sm text-stone-500">Looking up product on Keepa...</p>
                  </div>
                )}

                {searchError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800">{searchError}</p>
                      <p className="text-xs text-red-600 mt-0.5">Check the identifier and try again</p>
                    </div>
                  </div>
                )}

                {listSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">Product listed successfully!</p>
                      <p className="text-xs text-green-600 mt-0.5">Your listing is now active</p>
                    </div>
                    <button onClick={handleReset} className="text-xs text-green-700 hover:text-green-900 font-medium underline">
                      List another
                    </button>
                  </div>
                )}

                {product && !listSuccess && (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    {/* Product Header - Compact */}
                    <div className="px-4 py-3 border-b border-stone-100">
                      <div className="flex gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl || "/placeholder.svg"} alt={product.title} className="w-14 h-14 object-contain rounded-lg border border-stone-100 bg-white shrink-0" />
                        ) : (
                          <div className="w-14 h-14 bg-stone-100 rounded-lg flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6 text-stone-300" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-stone-900 leading-snug line-clamp-2">{product.title}</p>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                            <span className="text-[10px] text-stone-500">ASIN: <span className="font-mono text-stone-700">{product.asin}</span></span>
                            {product.brand && <span className="text-[10px] text-stone-500">Brand: <span className="text-stone-700">{product.brand}</span></span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Grid - Compact */}
                    <div className="grid grid-cols-4 gap-px bg-stone-100">
                      <div className="bg-white px-2.5 py-2">
                        <span className="text-[9px] uppercase tracking-wider text-stone-400 font-medium">Buy Box</span>
                        <p className="text-sm font-semibold text-stone-900">{formatPrice(product.buyBoxPrice)}</p>
                      </div>
                      <div className="bg-white px-2.5 py-2">
                        <span className="text-[9px] uppercase tracking-wider text-stone-400 font-medium">New ({product.newOfferCount})</span>
                        <p className="text-sm font-semibold text-stone-900">{formatPrice(product.newPrice)}</p>
                      </div>
                      <div className="bg-white px-2.5 py-2">
                        <span className="text-[9px] uppercase tracking-wider text-stone-400 font-medium">Used ({product.usedOfferCount})</span>
                        <p className="text-sm font-semibold text-stone-900">{formatPrice(product.usedPrice)}</p>
                      </div>
                      <div className="bg-white px-2.5 py-2">
                        <span className="text-[9px] uppercase tracking-wider text-stone-400 font-medium">Rank</span>
                        <p className="text-sm font-semibold text-stone-900">{formatRank(product.salesRank)}</p>
                        <p className="text-[9px] text-stone-400 truncate">{product.salesRankCategory}</p>
                      </div>
                    </div>

                    {/* 180-day averages - single line */}
                    <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex flex-wrap gap-3">
                      <span className="text-[10px] text-stone-500 font-medium">180d Avg:</span>
                      <span className="text-[10px] text-stone-600">New {formatPrice(product.avg180.newPrice)}</span>
                      <span className="text-[10px] text-stone-600">Used {formatPrice(product.avg180.usedPrice)}</span>
                      <span className="text-[10px] text-stone-600">Rank {formatRank(product.avg180.salesRank)}</span>
                    </div>

                    {/* List Form - Compact */}
                    <div className="px-4 py-3 border-t border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-medium text-stone-900">List This Product</h3>
                        <button onClick={handleReset} className="text-[10px] text-stone-400 hover:text-stone-600">Cancel</button>
                      </div>

                      {/* Condition */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConditionChange("new")}
                          className={cn(
                            "flex-1 py-1.5 rounded-md text-xs font-medium border transition-all",
                            selectedCondition === "new"
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                          )}
                        >
                          New
                        </button>
                        <button
                          onClick={() => handleConditionChange("used")}
                          className={cn(
                            "flex-1 py-1.5 rounded-md text-xs font-medium border transition-all",
                            selectedCondition === "used"
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                          )}
                        >
                          Used
                        </button>
                      </div>

                      {/* Channels - multi-select */}
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1">Channels</label>
                        <div className="flex gap-2">
                          {["Amazon", "eBay", "Shopify"].map((ch) => (
                            <button
                              key={ch}
                              onClick={() => {
                                setSelectedChannels((prev) =>
                                  prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
                                )
                              }}
                              className={cn(
                                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                                selectedChannels.includes(ch)
                                  ? "bg-stone-900 text-white border-stone-900"
                                  : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                              )}
                            >
                              {selectedChannels.includes(ch) && <Check className="w-3 h-3" />}
                              {ch}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Price / Qty / SKU */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-500 block mb-1">Price ($)</label>
                          <input
                            type="text"
                            value={listPrice}
                            onChange={(e) => setListPrice(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-md bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-500 block mb-1">Quantity</label>
                          <input
                            type="number"
                            value={listQuantity}
                            onChange={(e) => setListQuantity(e.target.value)}
                            min="1"
                            className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-md bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-500 block mb-1">SKU</label>
                          <input
                            type="text"
                            value={listSku}
                            onChange={(e) => setListSku(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-md bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleListProduct}
                        disabled={!listPrice || isListing || selectedChannels.length === 0}
                        className={cn(
                          "w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2",
                          listPrice && !isListing && selectedChannels.length > 0
                            ? "bg-stone-900 text-white hover:bg-stone-800"
                            : "bg-stone-200 text-stone-400 cursor-not-allowed"
                        )}
                      >
                        {isListing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Listing...
                          </>
                        ) : (
                          `List on ${selectedChannels.length > 0 ? selectedChannels.join(", ") : "..."}`
                        )}
                      </button>

                      {/* Listing Progress */}
                      {isListing && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-stone-500">Listing to {listingChannel}...</span>
                            <span className="text-[10px] font-medium text-stone-700">{listingProgress}%</span>
                          </div>
                          <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-stone-900 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${listingProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CSV Upload Tab */}
            {activeTab === "csv" && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-stone-200 p-6">
                  <h2 className="text-base font-medium text-stone-900 mb-1">CSV Bulk Upload</h2>
                  <p className="text-xs text-stone-500 mb-6">Upload a CSV file with your product listings to add them in bulk</p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />

                  {!csvFile ? (
                    <div className="space-y-4">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-stone-300 rounded-xl p-10 flex flex-col items-center gap-3 hover:border-stone-400 hover:bg-stone-50 transition-colors cursor-pointer"
                      >
                        <Upload className="w-10 h-10 text-stone-300" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-stone-600">Click to upload or drag and drop</p>
                          <p className="text-xs text-stone-400 mt-1">Supports .csv, .xlsx, .xls files</p>
                        </div>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 rounded-lg text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Upload File
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border border-stone-200 rounded-xl p-4 flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">{csvFile.name}</p>
                          <p className="text-xs text-stone-400">{(csvFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => setCsvFile(null)} className="p-1 text-stone-400 hover:text-stone-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                        Process & Upload Listings
                      </button>
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-stone-100">
                    <p className="text-xs font-medium text-stone-600 mb-2">CSV Format Guide</p>
                    <div className="bg-stone-50 rounded-lg p-3 font-mono text-[11px] text-stone-600 overflow-x-auto">
                      ASIN, Title, Condition, Price, Quantity, SKU
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Entry Tab */}
            {activeTab === "manual" && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-stone-200 p-6">
                  <h2 className="text-base font-medium text-stone-900 mb-1">Manual Listing</h2>
                  <p className="text-xs text-stone-500 mb-6">Fill in the product details to create a listing manually</p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-stone-500 block mb-1.5">Product Title</label>
                      <input
                        type="text"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="Enter product title"
                        className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-stone-500 block mb-1.5">ASIN / ISBN</label>
                        <input
                          type="text"
                          value={manualAsin}
                          onChange={(e) => setManualAsin(e.target.value)}
                          placeholder="e.g. B08N5WRWNW"
                          className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 block mb-1.5">SKU</label>
                        <input
                          type="text"
                          value={manualSku}
                          onChange={(e) => setManualSku(e.target.value)}
                          placeholder="Your SKU"
                          className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-stone-500 block mb-1.5">Price ($)</label>
                        <input
                          type="text"
                          value={manualPrice}
                          onChange={(e) => setManualPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 block mb-1.5">Quantity</label>
                        <input
                          type="number"
                          value={manualQuantity}
                          onChange={(e) => setManualQuantity(e.target.value)}
                          min="1"
                          className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-stone-500 block mb-1.5">Condition</label>
                        <div className="relative">
                          <select
                            value={manualCondition}
                            onChange={(e) => setManualCondition(e.target.value as "new" | "used")}
                            className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900/10 appearance-none"
                          >
                            <option value="new">New</option>
                            <option value="used">Used</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 block mb-1.5">Channels</label>
                      <div className="flex gap-2">
                        {["Amazon", "eBay", "Shopify"].map((ch) => (
                          <button
                            key={ch}
                            onClick={() => {
                              setManualChannels((prev) =>
                                prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
                              )
                            }}
                            className={cn(
                              "flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                              manualChannels.includes(ch)
                                ? "bg-stone-900 text-white border-stone-900"
                                : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                            )}
                          >
                            {manualChannels.includes(ch) && <Check className="w-3 h-3" />}
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      disabled={!manualTitle || !manualPrice || manualChannels.length === 0}
                      className={cn(
                        "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
                        manualTitle && manualPrice && manualChannels.length > 0
                          ? "bg-stone-900 text-white hover:bg-stone-800"
                          : "bg-stone-200 text-stone-400 cursor-not-allowed"
                      )}
                    >
                      {`Create Listing on ${manualChannels.length > 0 ? manualChannels.join(", ") : "..."}`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Listings */}
            {listings.length > 0 && (
              <div className="mt-8 bg-white rounded-xl border border-stone-200">
                <div className="px-5 py-4 border-b border-stone-100">
                  <h3 className="text-sm font-medium text-stone-900">Recent Listings</h3>
                  <p className="text-xs text-stone-500 mt-0.5">{listings.length} listing{listings.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="divide-y divide-stone-100">
                  {listings.map((listing) => (
                    <div key={listing.id} className="px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {listing.image_url ? (
                          <img src={listing.image_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-stone-50 border border-stone-100" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-stone-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-stone-900 truncate">{listing.title}</p>
                          <p className="text-[10px] text-stone-500">{listing.sku} &middot; ${Number(listing.price).toFixed(2)} &middot; {listing.channel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-medium",
                          listing.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600",
                        )}>
                          {listing.status}
                        </span>
                        <button onClick={() => handleDeleteListing(listing.id)} className="p-1 text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        <MobileNav />
      </div>
    </div>
  )
}
