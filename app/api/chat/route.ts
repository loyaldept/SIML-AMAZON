import {
  streamText,
  tool,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
} from "ai"
import { openai } from "@ai-sdk/openai"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

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

// --- All tools ---
const tools = {
  searchInventory: searchInventoryTool,
  getInventorySummary: getInventorySummaryTool,
  getOrders: getOrdersTool,
  getListings: getListingsTool,
  getChannelStatus: getChannelStatusTool,
  getFinancialSummary: getFinancialSummaryTool,
}

export async function POST(req: Request) {
  try {
  const body = await req.json()
  const messages: UIMessage[] = body.messages

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `You are Siml AI, an intelligent e-commerce assistant built into the Siml multi-channel listing platform. You help Amazon, eBay, and Shopify sellers manage their business.

You have access to tools that look up REAL inventory, orders, listings, financial data, and channel connection status from the user's actual accounts.

TWO-LANE ROUTING:
1. GENERAL questions ("What is FBA?", "How to price books?", "Tips for Q4 sales") -> Answer directly from your knowledge. No tools needed.
2. BUSINESS/INVENTORY questions ("Do we have SKU X?", "How many units?", "Show my orders", "What's my revenue?", "Am I connected to Amazon?") -> ALWAYS use the appropriate tool to look up real data, then present the results clearly.

RULES:
- Be concise, friendly, and actionable.
- When presenting data from tools, format it clearly with numbers and bullet points.
- If a tool returns empty results, say so honestly and suggest next steps (e.g. "Your inventory is empty - try listing your first product from the List page").
- NEVER fabricate inventory data, order numbers, or financial figures. Always use tools for real data.
- For connecting Amazon: tell users to click "Connect" next to Amazon in the sidebar or go to Settings > Channel Connections. This will redirect them to Amazon Seller Central to authorize the connection.
- For listing products: go to the List page, search by ASIN/UPC/ISBN, set price/quantity/condition, select channels, and click List.
- You have access to Amazon SP-API data through the platform, including Orders, Inventory, Listings, Pricing, and Finances.
- When multiple tools could help, call them all to give a comprehensive answer.`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse()
  } catch (error: any) {
    console.error("[v0] Chat API error:", error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
