import type { InventoryItem, Shipment, RepricingRule, ListingDraft, Sale, ChatMessage } from "./types"

const STORAGE_KEYS = {
  INVENTORY: "siml_inventory",
  SHIPMENTS: "siml_shipments",
  REPRICING_RULES: "siml_repricing_rules",
  LISTING_DRAFTS: "siml_listing_drafts",
  SALES: "siml_sales",
  CHAT_MESSAGES: "siml_chat_messages",
  SETTINGS: "siml_settings",
  USER: "siml_user",
}

const PRODUCT_IMAGES: Record<string, string> = {
  headphones: "/products/headphones.jpg",
  cable: "/products/cable.jpg",
  kitchen: "/products/kitchen.jpg",
  lamp: "/products/lamp.jpg",
  keyboard: "/products/keyboard.jpg",
  bottle: "/products/bottle.jpg",
  speaker: "/products/speaker.jpg",
  fitness: "/products/fitness.jpg",
  backpack: "/products/backpack.jpg",
  charger: "/products/charger.jpg",
  home: "/products/home.jpg",
  tech: "/products/tech.jpg",
}

function getProductImage(title: string): string {
  const t = title.toLowerCase()
  if (t.includes("headphone") || t.includes("earbuds") || t.includes("earplugs")) return PRODUCT_IMAGES.headphones
  if (t.includes("cable") || t.includes("hdmi") || t.includes("usb") || t.includes("hub") || t.includes("strip light")) return PRODUCT_IMAGES.cable
  if (t.includes("cutting") || t.includes("kitchen") || t.includes("utensil") || t.includes("frother") || t.includes("skillet") || t.includes("food storage") || t.includes("thermometer") || t.includes("pepper") || t.includes("spice") || t.includes("kettle") || t.includes("baking") || t.includes("air fryer") || t.includes("vacuum sealer")) return PRODUCT_IMAGES.kitchen
  if (t.includes("lamp") || t.includes("light") || t.includes("ring light")) return PRODUCT_IMAGES.lamp
  if (t.includes("keyboard") || t.includes("mouse") || t.includes("webcam") || t.includes("desk mat") || t.includes("mouse pad") || t.includes("monitor")) return PRODUCT_IMAGES.keyboard
  if (t.includes("bottle") || t.includes("straw")) return PRODUCT_IMAGES.bottle
  if (t.includes("speaker") || t.includes("bluetooth car") || t.includes("wi-fi")) return PRODUCT_IMAGES.speaker
  if (t.includes("yoga") || t.includes("resistance") || t.includes("compression") || t.includes("hand warmer")) return PRODUCT_IMAGES.fitness
  if (t.includes("backpack") || t.includes("packing") || t.includes("lunch bag") || t.includes("produce bag")) return PRODUCT_IMAGES.backpack
  if (t.includes("charger") || t.includes("charging") || t.includes("power strip") || t.includes("smart plug") || t.includes("surge")) return PRODUCT_IMAGES.charger
  if (t.includes("soap") || t.includes("shower") || t.includes("towel") || t.includes("door") || t.includes("drawer") || t.includes("drying") || t.includes("whiteboard") || t.includes("diffuser") || t.includes("organizer") || t.includes("cable management") || t.includes("cable tray") || t.includes("cable clip") || t.includes("desk fan") || t.includes("alarm") || t.includes("pillow") || t.includes("garment")) return PRODUCT_IMAGES.home
  if (t.includes("projector") || t.includes("stand") || t.includes("mount") || t.includes("phone") || t.includes("screen") || t.includes("trimmer") || t.includes("toothbrush") || t.includes("scale") || t.includes("cleaning") || t.includes("pill")) return PRODUCT_IMAGES.tech
  return PRODUCT_IMAGES.home
}

const generateSampleInventory = (): InventoryItem[] => {
  const products = [
    { title: "Wireless Bluetooth Headphones", price: 49.99, cost: 22.50 },
    { title: "USB-C Charging Cable 6ft", price: 12.99, cost: 3.20 },
    { title: "Portable Phone Stand Holder", price: 15.99, cost: 4.50 },
    { title: "LED Desk Lamp with USB Port", price: 34.99, cost: 15.00 },
    { title: "Mechanical Keyboard RGB", price: 79.99, cost: 38.00 },
    { title: "Silicone Baking Mat Set", price: 14.99, cost: 4.80 },
    { title: "Stainless Steel Water Bottle 32oz", price: 24.99, cost: 8.50 },
    { title: "Yoga Mat Non-Slip 6mm", price: 29.99, cost: 10.00 },
    { title: "Wireless Mouse Ergonomic", price: 22.99, cost: 9.00 },
    { title: "Screen Protector Tempered Glass (3-Pack)", price: 9.99, cost: 1.80 },
    { title: "Car Phone Mount Magnetic", price: 16.99, cost: 5.20 },
    { title: "Bamboo Cutting Board Set", price: 27.99, cost: 11.00 },
    { title: "Electric Milk Frother", price: 19.99, cost: 7.50 },
    { title: "Smart Plug Wi-Fi Outlet", price: 13.99, cost: 4.00 },
    { title: "Resistance Bands Set (5-Pack)", price: 18.99, cost: 5.50 },
    { title: "Portable Bluetooth Speaker", price: 39.99, cost: 16.00 },
    { title: "HDMI Cable 10ft 4K", price: 11.99, cost: 2.80 },
    { title: "Adjustable Laptop Stand", price: 32.99, cost: 13.50 },
    { title: "Memory Foam Pillow", price: 44.99, cost: 18.00 },
    { title: "Glass Food Storage Containers (5-Set)", price: 34.99, cost: 14.00 },
    { title: "Ring Light 10-inch with Tripod", price: 26.99, cost: 10.50 },
    { title: "Wireless Earbuds Sport", price: 35.99, cost: 14.50 },
    { title: "Kitchen Scale Digital", price: 15.99, cost: 5.00 },
    { title: "Microfiber Cleaning Cloth (12-Pack)", price: 10.99, cost: 2.50 },
    { title: "USB Hub 7-Port USB 3.0", price: 21.99, cost: 8.00 },
    { title: "Electric Toothbrush Sonic", price: 39.99, cost: 15.00 },
    { title: "Packing Cubes Travel Set (6-Pack)", price: 22.99, cost: 7.00 },
    { title: "Desk Organizer Wood", price: 28.99, cost: 12.00 },
    { title: "LED Strip Lights 50ft", price: 17.99, cost: 5.80 },
    { title: "Instant Read Meat Thermometer", price: 13.99, cost: 4.20 },
    { title: "Webcam HD 1080p", price: 44.99, cost: 19.00 },
    { title: "Portable Charger 20000mAh", price: 29.99, cost: 12.50 },
    { title: "Stainless Steel Straws (8-Pack)", price: 8.99, cost: 2.00 },
    { title: "Shower Head High Pressure", price: 23.99, cost: 9.50 },
    { title: "Cable Management Box", price: 16.99, cost: 5.50 },
    { title: "Air Fryer Silicone Liner", price: 11.99, cost: 3.00 },
    { title: "Under Desk Cable Tray", price: 19.99, cost: 7.00 },
    { title: "Reusable Produce Bags (12-Pack)", price: 12.99, cost: 3.50 },
    { title: "Magnetic Whiteboard Small", price: 18.99, cost: 6.50 },
    { title: "Wireless Charging Pad 15W", price: 14.99, cost: 4.50 },
    { title: "Cast Iron Skillet 10-inch", price: 32.99, cost: 14.00 },
    { title: "Collapsible Water Bottle", price: 14.99, cost: 4.00 },
    { title: "USB Desk Fan Quiet", price: 16.99, cost: 5.50 },
    { title: "Door Stopper Rubber (4-Pack)", price: 7.99, cost: 1.50 },
    { title: "Backpack Laptop 15.6-inch", price: 45.99, cost: 20.00 },
    { title: "Surge Protector Power Strip", price: 24.99, cost: 9.00 },
    { title: "Essential Oil Diffuser", price: 26.99, cost: 10.00 },
    { title: "Desk Mat Leather XL", price: 21.99, cost: 7.50 },
    { title: "Automatic Soap Dispenser", price: 28.99, cost: 11.00 },
    { title: "Gaming Mouse Pad XXL", price: 15.99, cost: 4.50 },
    { title: "Bluetooth Car Adapter FM", price: 18.99, cost: 6.00 },
    { title: "Silicone Kitchen Utensil Set", price: 24.99, cost: 8.50 },
    { title: "Clip-On Desk Light LED", price: 19.99, cost: 7.00 },
    { title: "Foldable Clothes Drying Rack", price: 29.99, cost: 12.00 },
    { title: "Insulated Lunch Bag", price: 17.99, cost: 6.00 },
    { title: "Wi-Fi Range Extender", price: 33.99, cost: 14.00 },
    { title: "Electric Hand Warmer Rechargeable", price: 22.99, cost: 8.50 },
    { title: "Digital Alarm Clock LED", price: 13.99, cost: 4.50 },
    { title: "Vacuum Sealer Machine", price: 39.99, cost: 17.00 },
    { title: "Towel Rack Over Door", price: 15.99, cost: 5.00 },
    { title: "Beard Trimmer Cordless", price: 34.99, cost: 14.50 },
    { title: "Portable Mini Projector", price: 89.99, cost: 42.00 },
    { title: "Wall Mount Phone Holder", price: 9.99, cost: 2.50 },
    { title: "Electric Pepper Grinder Set", price: 27.99, cost: 11.50 },
    { title: "Noise Cancelling Earplugs", price: 18.99, cost: 6.00 },
    { title: "Drawer Organizer Adjustable", price: 16.99, cost: 5.50 },
    { title: "Magnetic Spice Rack Jars (6-Set)", price: 31.99, cost: 13.00 },
    { title: "Bike Phone Mount Waterproof", price: 14.99, cost: 4.50 },
    { title: "Electric Kettle 1.7L", price: 36.99, cost: 15.50 },
    { title: "Compression Socks (3-Pack)", price: 19.99, cost: 6.50 },
    { title: "Monitor Stand Riser Wood", price: 25.99, cost: 10.00 },
    { title: "Handheld Garment Steamer", price: 29.99, cost: 12.50 },
    { title: "Pill Organizer Weekly", price: 8.99, cost: 2.00 },
    { title: "Door Draft Stopper", price: 12.99, cost: 3.50 },
    { title: "Desk Cable Clips (12-Pack)", price: 6.99, cost: 1.20 },
  ]

  const channels = ["FBA", "FBM", "Amazon", "eBay"]
  const statuses: InventoryItem["status"][] = ["active", "active", "active", "active", "active", "out_of_stock", "inactive"]

  return products.map((p, i) => ({
    id: `${i + 1}`,
    sku: `SKU-${String(i + 1).padStart(3, "0")}`,
    asin: `B0${String(Math.floor(Math.random() * 9000000 + 1000000))}`,
    title: p.title,
    imageUrl: getProductImage(p.title),
    quantity: statuses[i % statuses.length] === "out_of_stock" ? 0 : Math.floor(Math.random() * 200) + 1,
    price: p.price,
    cost: p.cost,
    channel: channels[i % channels.length],
    status: statuses[i % statuses.length],
    lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
  }))
}

const generateSampleShipments = (): Shipment[] => [
  {
    id: "1",
    shipmentId: "FBA16ABC123",
    destination: "PHX5 - Phoenix, AZ",
    status: "receiving",
    items: 5,
    units: 150,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "2",
    shipmentId: "FBA16DEF456",
    destination: "ONT8 - San Bernardino, CA",
    status: "shipped",
    items: 8,
    units: 240,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    shippedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "3",
    shipmentId: "FBA16GHI789",
    destination: "SDF8 - Shepherdsville, KY",
    status: "working",
    items: 3,
    units: 75,
    createdAt: new Date(),
  },
]

const generateSampleRepricingRules = (): RepricingRule[] => [
  {
    id: "1",
    name: "Match Lowest FBA",
    strategy: "match_lowest",
    value: 0,
    minPrice: 5.0,
    maxPrice: 500.0,
    isActive: true,
    appliedTo: 45,
  },
  {
    id: "2",
    name: "Beat by 2%",
    strategy: "beat_by_percent",
    value: 2,
    minPrice: 10.0,
    maxPrice: 200.0,
    isActive: true,
    appliedTo: 28,
  },
  {
    id: "3",
    name: "Stay Above Cost + 30%",
    strategy: "stay_above_cost",
    value: 30,
    minPrice: 0,
    maxPrice: 1000.0,
    isActive: false,
    appliedTo: 12,
  },
]

const generateSampleSales = (): Sale[] => {
  const sales: Sale[] = []
  const channels = ["Amazon", "eBay", "Shopify"]
  const products = ["Wireless Headphones", "USB Cable", "Phone Stand", "Desk Lamp", "Keyboard"]

  for (let i = 0; i < 30; i++) {
    sales.push({
      id: `sale-${i}`,
      productId: `${(i % 5) + 1}`,
      productTitle: products[i % 5],
      profit: Math.random() * 25 + 5,
      revenue: Math.random() * 80 + 20,
      saleDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      channel: channels[i % 3],
    })
  }
  return sales
}

export const storage = {
  // Inventory
  getInventory: (): InventoryItem[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.INVENTORY)
    const parsed = data ? JSON.parse(data) : null
    // Regenerate if missing, stale, or missing images
    if (!parsed || parsed.length < 50 || !parsed[0]?.imageUrl) {
      const sample = generateSampleInventory()
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(sample))
      return sample
    }
    return parsed
  },

  saveInventoryItem: (item: InventoryItem) => {
    const inventory = storage.getInventory()
    const index = inventory.findIndex((i) => i.id === item.id)
    if (index >= 0) {
      inventory[index] = item
    } else {
      inventory.unshift(item)
    }
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory))
  },

  // Shipments
  getShipments: (): Shipment[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.SHIPMENTS)
    if (!data) {
      const sample = generateSampleShipments()
      localStorage.setItem(STORAGE_KEYS.SHIPMENTS, JSON.stringify(sample))
      return sample
    }
    return JSON.parse(data)
  },

  saveShipment: (shipment: Shipment) => {
    const shipments = storage.getShipments()
    const index = shipments.findIndex((s) => s.id === shipment.id)
    if (index >= 0) {
      shipments[index] = shipment
    } else {
      shipments.unshift(shipment)
    }
    localStorage.setItem(STORAGE_KEYS.SHIPMENTS, JSON.stringify(shipments))
  },

  // Repricing Rules
  getRepricingRules: (): RepricingRule[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.REPRICING_RULES)
    if (!data) {
      const sample = generateSampleRepricingRules()
      localStorage.setItem(STORAGE_KEYS.REPRICING_RULES, JSON.stringify(sample))
      return sample
    }
    return JSON.parse(data)
  },

  saveRepricingRule: (rule: RepricingRule) => {
    const rules = storage.getRepricingRules()
    const index = rules.findIndex((r) => r.id === rule.id)
    if (index >= 0) {
      rules[index] = rule
    } else {
      rules.unshift(rule)
    }
    localStorage.setItem(STORAGE_KEYS.REPRICING_RULES, JSON.stringify(rules))
  },

  deleteRepricingRule: (id: string) => {
    const rules = storage.getRepricingRules().filter((r) => r.id !== id)
    localStorage.setItem(STORAGE_KEYS.REPRICING_RULES, JSON.stringify(rules))
  },

  // Listing Drafts
  getListingDrafts: (): ListingDraft[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.LISTING_DRAFTS)
    return data ? JSON.parse(data) : []
  },

  saveListingDraft: (draft: ListingDraft) => {
    const drafts = storage.getListingDrafts()
    const index = drafts.findIndex((d) => d.id === draft.id)
    if (index >= 0) {
      drafts[index] = draft
    } else {
      drafts.unshift(draft)
    }
    localStorage.setItem(STORAGE_KEYS.LISTING_DRAFTS, JSON.stringify(drafts))
  },

  deleteListingDraft: (id: string) => {
    const drafts = storage.getListingDrafts().filter((d) => d.id !== id)
    localStorage.setItem(STORAGE_KEYS.LISTING_DRAFTS, JSON.stringify(drafts))
  },

  // Sales
  getSales: (): Sale[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.SALES)
    if (!data) {
      const sample = generateSampleSales()
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sample))
      return sample
    }
    return JSON.parse(data)
  },

  // Chat Messages
  getChatMessages: (): ChatMessage[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES)
    return data ? JSON.parse(data) : []
  },

  saveChatMessage: (message: ChatMessage) => {
    const messages = storage.getChatMessages()
    messages.push(message)
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages))
  },

  clearChatMessages: () => {
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify([]))
  },

  // User
  getUser: () => {
    if (typeof window === "undefined") return null
    const data = localStorage.getItem(STORAGE_KEYS.USER)
    return data ? JSON.parse(data) : null
  },

  setUser: (user: any) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  },

  clearUser: () => {
    localStorage.removeItem(STORAGE_KEYS.USER)
  },
}
