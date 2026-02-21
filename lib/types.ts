export interface InventoryItem {
  id: string
  sku: string
  asin: string
  title: string
  imageUrl: string
  quantity: number
  price: number
  cost: number
  channel: "FBA" | "FBM" | "Amazon" | "eBay" | "Shopify" | string
  status: "active" | "inactive" | "out_of_stock"
  lastUpdated: Date
}

export interface Shipment {
  id: string
  shipmentId: string
  destination: string
  status: "draft" | "working" | "shipped" | "receiving" | "closed"
  items: number
  units: number
  createdAt: Date
  shippedAt?: Date
}

export interface RepricingRule {
  id: string
  name: string
  strategy: "match_lowest" | "beat_by_percent" | "beat_by_amount" | "stay_above_cost"
  value: number
  minPrice: number
  maxPrice: number
  isActive: boolean
  appliedTo: number
}

export interface ListingDraft {
  id: string
  title: string
  asin?: string
  sku: string
  price: number
  quantity: number
  condition: "new" | "like_new" | "good" | "acceptable"
  channel: "Amazon" | "eBay" | "Shopify"
  status: "draft" | "pending" | "listed" | "error"
  createdAt: Date
}

export interface Sale {
  id: string
  productId: string
  productTitle: string
  profit: number
  revenue: number
  saleDate: Date
  channel: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}
