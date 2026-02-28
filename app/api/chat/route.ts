import {
  streamText,
  tool,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
} from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export const maxDuration = 30

// --- Tool definitions for inventory/business queries ---

const searchInventoryTool = tool({
  description:
    "Search the user's inventory by product title, SKU, or ASIN. Use when the user asks about specific products, stock levels, or inventory items.",
  inputSchema: z.object({
    query: z.string().describe("Search term - product name, SKU, or ASIN"),
  }),
  execute: async ({ query }: { query: string }) => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: items } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", user.id)
      .or(
        `title.ilike.%${query}%,sku.ilike.%${query}%,asin.ilike.%${query}%`
      )
      .limit(10)

    return {
      items:
        items?.map((i) => ({
          title: i.title,
          sku: i.sku,
          asin: i.asin,
          quantity: i.quantity,
          price: i.price,
          condition: i.condition,
          channel: i.channel,
          warehouse: i.warehouse,
          fulfillment: i.fulfillment_channel,
        })) || [],
      count: items?.length || 0,
    }
  },
})

const getInventorySummaryTool = tool({
  description:
    "Get a summary of the user's total inventory: total SKUs, total units, total value, and low stock items. Use when the user asks about overall inventory status or health.",
  inputSchema: z.object({}),
  execute: async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: items } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", user.id)

    if (!items)
      return { total_skus: 0, total_units: 0, total_value: 0, low_stock: [] }

    const totalUnits = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
    const totalValue = items.reduce(
      (sum, i) => sum + (i.price || 0) * (i.quantity || 0),
      0
    )
    const lowStock = items.filter((i) => (i.quantity || 0) <= 5)

    return {
      total_skus: items.length,
      total_units: totalUnits,
      total_value: Math.round(totalValue * 100) / 100,
      low_stock: lowStock.map((i) => ({
        title: i.title,
        sku: i.sku,
        quantity: i.quantity,
      })),
      channels: [...new Set(items.map((i) => i.channel).filter(Boolean))],
    }
  },
})

const getOrdersTool = tool({
  description:
    "Get the user's recent orders from all channels. Use when the user asks about orders, sales, recent purchases, or order status.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .describe("Number of orders to return, default 10"),
    status: z
      .string()
      .optional()
      .describe("Filter by order status like 'Shipped', 'Unshipped'"),
  }),
  execute: async ({
    limit,
    status,
  }: {
    limit?: number
    status?: string
  }) => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    let query = supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("order_date", { ascending: false })
      .limit(limit || 10)

    if (status) {
      query = query.eq("status", status)
    }

    const { data: orders } = await query

    const totalRevenue =
      orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0

    return {
      orders:
        orders?.map((o) => ({
          order_id: o.amazon_order_id,
          status: o.status,
          total: o.total_amount,
          currency: o.currency,
          items_count: o.items_count,
          date: o.order_date,
          channel: o.channel,
        })) || [],
      count: orders?.length || 0,
      total_revenue: Math.round(totalRevenue * 100) / 100,
    }
  },
})

const getListingsTool = tool({
  description:
    "Get the user's product listings across channels. Use when the user asks about their listed products, listing status, or pricing.",
  inputSchema: z.object({
    channel: z
      .string()
      .optional()
      .describe("Filter by channel like 'Amazon', 'eBay', 'Shopify'"),
  }),
  execute: async ({ channel }: { channel?: string }) => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    let query = supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (channel) {
      query = query.eq("channel", channel)
    }

    const { data: listings } = await query

    return {
      listings:
        listings?.map((l) => ({
          title: l.title,
          sku: l.sku,
          asin: l.asin,
          price: l.price,
          quantity: l.quantity,
          condition: l.condition,
          channel: l.channel,
          status: l.status,
        })) || [],
      count: listings?.length || 0,
    }
  },
})

const getChannelStatusTool = tool({
  description:
    "Check which marketplace channels are connected (Amazon, eBay, Shopify). Use when the user asks about their connections or account status.",
  inputSchema: z.object({}),
  execute: async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: channels } = await supabase
      .from("channel_connections")
      .select("channel, status, store_name, seller_id, marketplace_id")
      .eq("user_id", user.id)

    return {
      channels:
        channels?.map((c) => ({
          channel: c.channel,
          connected: c.status === "connected",
          store_name: c.store_name,
          seller_id: c.seller_id,
          marketplace_id: c.marketplace_id,
        })) || [],
    }
  },
})

const getFinancialSummaryTool = tool({
  description:
    "Get financial summary: total revenue, average order value, order counts. Use when the user asks about revenue, profits, financial performance, or earnings.",
  inputSchema: z.object({}),
  execute: async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)

    const totalRevenue =
      orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0
    const avgOrderValue = orders?.length ? totalRevenue / orders.length : 0

    return {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_orders: orders?.length || 0,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      currency: "USD",
    }
  },
})

const runStoreScanTool = tool({
  description:
    "Run a comprehensive store scan and analysis. Checks inventory health, stock alerts, account health indicators, compliance metrics, sales performance, and generates actionable recommendations. Use when the user asks to scan, analyze, or audit their store, or asks about store health, compliance, or wants a full report.",
  inputSchema: z.object({}),
  execute: async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch all data in parallel
    const [channelsRes, inventoryRes, ordersRes, listingsRes] = await Promise.all([
      supabase
        .from("channel_connections")
        .select("channel, status, store_name, seller_id")
        .eq("user_id", user.id),
      supabase.from("inventory").select("*").eq("user_id", user.id),
      supabase.from("orders").select("*").eq("user_id", user.id),
      supabase.from("listings").select("*").eq("user_id", user.id),
    ])

    const channels = channelsRes.data || []
    const items = inventoryRes.data || []
    const orders = ordersRes.data || []
    const listings = listingsRes.data || []

    const connectedChannels = channels.filter((c) => c.status === "connected")

    // Inventory analysis
    const totalItems = items.length
    const totalUnits = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
    const totalValue = items.reduce(
      (sum, i) => sum + (i.price || 0) * (i.quantity || 0),
      0
    )
    const outOfStock = items.filter((i) => (i.quantity || 0) === 0)
    const lowStock = items.filter(
      (i) => (i.quantity || 0) > 0 && (i.quantity || 0) <= 5
    )
    const healthyStock = items.filter((i) => (i.quantity || 0) > 5)

    // Order analysis
    const totalOrders = orders.length
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    )
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const canceledOrders = orders.filter((o) => o.status === "Canceled")
    const shippedOrders = orders.filter((o) => o.status === "Shipped")
    const pendingOrders = orders.filter(
      (o) => o.status === "Unshipped" || o.status === "Pending"
    )
    const fulfillmentRate =
      totalOrders > 0 ? (shippedOrders.length / totalOrders) * 100 : 0
    const cancelRate =
      totalOrders > 0 ? (canceledOrders.length / totalOrders) * 100 : 0

    // Listing analysis
    const activeListings = listings.filter((l) => l.status === "active")
    const errorListings = listings.filter((l) => l.status === "error")
    const pendingListings = listings.filter((l) => l.status === "pending")

    // Health indicators
    const healthIndicators = {
      account_health:
        cancelRate <= 2.5 && fulfillmentRate >= 95
          ? "Excellent"
          : cancelRate <= 5 && fulfillmentRate >= 90
            ? "Good"
            : cancelRate <= 10 && fulfillmentRate >= 80
              ? "Needs Attention"
              : "At Risk",
      inventory_health:
        outOfStock.length === 0 && lowStock.length === 0
          ? "Excellent"
          : outOfStock.length === 0
            ? "Good"
            : outOfStock.length <= 3
              ? "Needs Attention"
              : "At Risk",
      order_defect_rate: cancelRate,
      fulfillment_rate: fulfillmentRate,
      late_shipment_indicator: cancelRate > 4 ? "Warning" : "Normal",
    }

    // Compliance checks
    const complianceIssues: string[] = []
    if (cancelRate > 2.5) {
      complianceIssues.push(
        `Cancellation rate (${cancelRate.toFixed(1)}%) exceeds Amazon's 2.5% threshold`
      )
    }
    if (fulfillmentRate < 95 && totalOrders > 0) {
      complianceIssues.push(
        `Fulfillment rate (${fulfillmentRate.toFixed(1)}%) is below the 95% target`
      )
    }
    if (errorListings.length > 0) {
      complianceIssues.push(
        `${errorListings.length} listing(s) have errors that need to be resolved`
      )
    }

    return {
      scan_type: "comprehensive",
      timestamp: new Date().toISOString(),
      connected_channels: connectedChannels.map((c) => ({
        channel: c.channel,
        store_name: c.store_name,
      })),
      inventory_summary: {
        total_skus: totalItems,
        total_units: totalUnits,
        estimated_value: Math.round(totalValue * 100) / 100,
        out_of_stock_items: outOfStock.map((i) => ({
          title: i.title,
          sku: i.sku,
          asin: i.asin,
        })),
        low_stock_items: lowStock.map((i) => ({
          title: i.title,
          sku: i.sku,
          asin: i.asin,
          quantity: i.quantity,
        })),
        healthy_items_count: healthyStock.length,
      },
      order_summary: {
        total_orders: totalOrders,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        shipped: shippedOrders.length,
        pending: pendingOrders.length,
        canceled: canceledOrders.length,
      },
      listing_summary: {
        total_listings: listings.length,
        active: activeListings.length,
        pending: pendingListings.length,
        errors: errorListings.length,
        error_listings: errorListings.map((l) => ({
          title: l.title,
          sku: l.sku,
          channel: l.channel,
        })),
      },
      health_indicators: healthIndicators,
      compliance_issues: complianceIssues,
    }
  },
})

// --- All tools ---
const tools = {
  searchInventory: searchInventoryTool,
  getInventorySummary: getInventorySummaryTool,
  getOrders: getOrdersTool,
  getListings: getListingsTool,
  getChannelStatus: getChannelStatusTool,
  getFinancialSummary: getFinancialSummaryTool,
  runStoreScan: runStoreScanTool,
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable. Add your Gemini API key to .env.local or your hosting provider's environment settings." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const body = await req.json()
    const messages: UIMessage[] = body.messages

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: `You are Siml AI, an intelligent e-commerce assistant built into the Siml multi-channel listing platform. You help Amazon, eBay, and Shopify sellers manage their business.

You have access to tools that look up REAL inventory, orders, listings, financial data, and channel connection status from the user's actual accounts.

TWO-LANE ROUTING:
1. GENERAL questions ("What is FBA?", "How to price books?", "Tips for Q4 sales") -> Answer directly from your knowledge. No tools needed. But even for general questions, try to make your advice RELEVANT to e-commerce sellers. Give practical, actionable seller tips rather than generic information.
2. BUSINESS/INVENTORY questions ("Do we have SKU X?", "How many units?", "Show my orders", "What's my revenue?", "Am I connected to Amazon?") -> ALWAYS use the appropriate tool to look up real data, then present the results clearly.

STORE SCAN & ANALYSIS:
When the user asks to scan, analyze, or audit their store (or clicks "Scan & Analyze"), use the runStoreScan tool to get comprehensive data. Then present a CONCISE, well-structured report covering:
- Account Health Status (with key indicators)
- Inventory Health (summary stats, ONLY list items that need attention like low/out of stock - do NOT list every single product)
- Sales Performance (key revenue and order metrics)
- Compliance Issues (if any)
- Top 3-5 Actionable Recommendations prioritized by impact

IMPORTANT FORMATTING RULES FOR SCANS:
- Do NOT list every individual product/book/item in the inventory. Only mention items that need attention (low stock, out of stock, errors).
- Give SUMMARY statistics (e.g., "42 products in stock, 3 low stock, 1 out of stock") instead of enumerating each one.
- Keep reports focused on what matters: problems to fix, opportunities to capture, and metrics that changed.
- Use tables sparingly and only for items that need action.

RESPONSE QUALITY:
- When the user asks about their inventory, use the inventory tools to get REAL data, then give specific advice based on what you find. For example, if they have low stock items, tell them which ones and suggest reorder quantities.
- When answering general seller questions, draw on e-commerce best practices: pricing strategies, Buy Box tips, seasonal planning, listing optimization, advertising tactics, etc.
- Tailor your answers to the seller's actual situation when possible. If you know from previous tool calls that they sell books on Amazon, make your advice book-selling specific.
- Be direct and action-oriented. Instead of "you might want to consider..." say "Do this: [specific action]."

RULES:
- Be concise, friendly, and actionable.
- When presenting data from tools, format it clearly with numbers and bullet points.
- If a tool returns empty results, say so honestly and suggest next steps (e.g. "Your inventory is empty - try listing your first product from the List page").
- NEVER fabricate inventory data, order numbers, or financial figures. Always use tools for real data.
- For connecting Amazon: tell users to click "Connect" next to Amazon in the sidebar or go to Settings > Channel Connections. This will redirect them to Amazon Seller Central to authorize the connection.
- For listing products: go to the List page, search by ASIN/UPC/ISBN, set price/quantity/condition, select channels, and click List.
- You have access to Amazon SP-API data through the platform, including Orders, Inventory, Listings, Pricing, and Finances.
- When multiple tools could help, call them all to give a comprehensive answer.
- Keep scan reports and summaries focused and brief. The user can ask follow-up questions for more detail on any area.`,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse()
  } catch (error: any) {
    const errMsg = error?.message || "Chat failed"
    console.error("[Chat] API error:", errMsg)

    const errorText = errMsg.includes("API key")
      ? "Invalid or missing Gemini API key. Check your GOOGLE_GENERATIVE_AI_API_KEY environment variable."
      : errMsg.includes("is not found for API version") || errMsg.includes("not supported for generateContent")
        ? "The configured Gemini model is unavailable. Please check that the model name is valid and supported."
        : errMsg.includes("429") || errMsg.includes("rate")
          ? "Rate limited by Gemini API. Please wait a moment and try again."
          : errMsg.includes("quota")
            ? "Gemini API quota exceeded. Check your Google Cloud billing."
            : `Chat error: ${errMsg}`

    return new Response(JSON.stringify({ error: errorText }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
