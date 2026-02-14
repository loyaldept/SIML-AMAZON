import { createClient } from "@/lib/supabase/server"

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"
const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com"

// --- Token Management ---

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.AMAZON_SP_CLIENT_ID!,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LWA token exchange failed: ${err}`)
  }
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  }>
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.AMAZON_SP_CLIENT_ID!,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LWA token refresh failed: ${err}`)
  }
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  }>
}

// --- Get a valid access token for a user's Amazon connection ---

export async function getAmazonToken(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from("channel_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", "Amazon")
    .single()

  if (!conn?.refresh_token) return null

  // Check if token is expired (with 5 min buffer)
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null
  if (expiresAt && expiresAt > new Date(Date.now() + 5 * 60 * 1000) && conn.access_token) {
    return conn.access_token
  }

  // Refresh the token
  try {
    const tokens = await refreshAccessToken(conn.refresh_token)
    const expiresAtNew = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await supabase
      .from("channel_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAtNew,
      })
      .eq("id", conn.id)

    return tokens.access_token
  } catch {
    return null
  }
}

// --- Generic SP-API caller ---

export async function callSpApi(
  accessToken: string,
  path: string,
  options: { method?: string; body?: any; query?: Record<string, string> } = {}
) {
  const url = new URL(path, SP_API_BASE)
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      "x-amz-access-token": accessToken,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SP-API ${path} failed (${res.status}): ${err}`)
  }
  return res.json()
}

// --- Sellers API ---

export async function getSellerInfo(accessToken: string) {
  return callSpApi(accessToken, "/sellers/v1/marketplaceParticipations")
}

// --- Orders API ---

export async function getOrders(accessToken: string, marketplaceIds: string[], createdAfter?: string) {
  return callSpApi(accessToken, "/orders/v0/orders", {
    query: {
      MarketplaceIds: marketplaceIds.join(","),
      CreatedAfter: createdAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  })
}

export async function getOrder(accessToken: string, orderId: string) {
  return callSpApi(accessToken, `/orders/v0/orders/${orderId}`)
}

export async function getOrderItems(accessToken: string, orderId: string) {
  return callSpApi(accessToken, `/orders/v0/orders/${orderId}/orderItems`)
}

// --- Catalog Items API ---

export async function searchCatalog(accessToken: string, keywords: string, marketplaceIds: string[]) {
  return callSpApi(accessToken, "/catalog/2022-04-01/items", {
    query: {
      keywords,
      marketplaceIds: marketplaceIds.join(","),
      includedData: "identifiers,images,productTypes,summaries,salesRanks",
      pageSize: "20",
    },
  })
}

export async function getCatalogItem(accessToken: string, asin: string, marketplaceIds: string[]) {
  return callSpApi(accessToken, `/catalog/2022-04-01/items/${asin}`, {
    query: {
      marketplaceIds: marketplaceIds.join(","),
      includedData: "identifiers,images,productTypes,summaries,salesRanks,attributes",
    },
  })
}

// --- Product Pricing API ---

export async function getMyPrice(accessToken: string, marketplaceId: string, asins: string[]) {
  // Max 20 ASINs per request
  return callSpApi(accessToken, "/products/pricing/v0/price", {
    query: {
      MarketplaceId: marketplaceId,
      ItemType: "Asin",
      Asins: asins.join(","),
    },
  })
}

export async function getCompetitivePricing(accessToken: string, marketplaceId: string, asins: string[]) {
  return callSpApi(accessToken, "/products/pricing/v0/competitivePrice", {
    query: {
      MarketplaceId: marketplaceId,
      ItemType: "Asin",
      Asins: asins.join(","),
    },
  })
}

// --- Listings API ---

export async function getListingsItem(accessToken: string, sellerId: string, sku: string, marketplaceIds: string[]) {
  return callSpApi(accessToken, `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`, {
    query: {
      marketplaceIds: marketplaceIds.join(","),
      includedData: "summaries,attributes,issues,offers,fulfillmentAvailability",
    },
  })
}

export async function putListingsItem(
  accessToken: string,
  sellerId: string,
  sku: string,
  marketplaceIds: string[],
  body: any
) {
  return callSpApi(accessToken, `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`, {
    method: "PUT",
    query: { marketplaceIds: marketplaceIds.join(",") },
    body,
  })
}

export async function deleteListingsItem(accessToken: string, sellerId: string, sku: string, marketplaceIds: string[]) {
  return callSpApi(accessToken, `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`, {
    method: "DELETE",
    query: { marketplaceIds: marketplaceIds.join(",") },
  })
}

// --- Pricing API ---

export async function getCompetitivePricing(accessToken: string, asin: string, marketplaceId: string) {
  return callSpApi(accessToken, "/products/pricing/v0/competitivePrice", {
    query: {
      MarketplaceId: marketplaceId,
      Asins: asin,
      ItemType: "Asin",
    },
  })
}

export async function getItemOffers(accessToken: string, asin: string, marketplaceId: string) {
  return callSpApi(accessToken, `/products/pricing/v0/items/${asin}/offers`, {
    query: {
      MarketplaceId: marketplaceId,
      ItemCondition: "New",
    },
  })
}

// --- Inventory (FBA) API ---

export async function getFbaInventory(accessToken: string, marketplaceIds: string[], nextToken?: string) {
  const query: Record<string, string> = {
    details: "true",
    granularityType: "Marketplace",
    granularityId: marketplaceIds[0],
    marketplaceIds: marketplaceIds.join(","),
  }
  if (nextToken) query.nextToken = nextToken
  return callSpApi(accessToken, "/fba/inventory/v1/summaries", { query })
}

// Get all inventory pages (handles pagination)
export async function getAllFbaInventory(accessToken: string, marketplaceIds: string[]) {
  const allSummaries: any[] = []
  let nextToken: string | undefined = undefined

  do {
    const response: any = await getFbaInventory(accessToken, marketplaceIds, nextToken)
    const payload = response?.payload || response || {}
    const summaries = payload?.inventorySummaries || []
    allSummaries.push(...summaries)
    nextToken = payload?.nextToken || response?.pagination?.nextToken
  } while (nextToken && allSummaries.length < 500) // Safety limit

  return allSummaries
}

// --- Finances API ---

export async function getFinancialEventGroups(accessToken: string, postedAfter?: string) {
  return callSpApi(accessToken, "/finances/v0/financialEventGroups", {
    query: {
      FinancialEventGroupStartedAfter: postedAfter || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
  })
}

export async function getFinancialEvents(accessToken: string, orderId: string) {
  return callSpApi(accessToken, `/finances/v0/orders/${orderId}/financialEvents`)
}

// --- Sales API ---

export async function getOrderMetrics(
  accessToken: string,
  marketplaceIds: string[],
  interval: string, // ISO 8601 interval e.g. "2025-01-01T00:00:00Z--2025-02-01T00:00:00Z"
  granularity: "Hour" | "Day" | "Week" | "Month" | "Year" | "Total" = "Day"
) {
  return callSpApi(accessToken, "/sales/v1/orderMetrics", {
    query: {
      marketplaceIds: marketplaceIds.join(","),
      interval,
      granularity,
    },
  })
}

// --- Messaging API (Buyer Communication) ---

export async function getMessagingActions(accessToken: string, orderId: string) {
  return callSpApi(accessToken, `/messaging/v1/orders/${orderId}`, {
    query: { marketplaceIds: "ATVPDKIKX0DER" },
  })
}

// --- Fulfillment Inbound (FBA Shipments) ---

export async function getInboundShipments(accessToken: string, queryStatus: string = "WORKING") {
  return callSpApi(accessToken, "/fba/inbound/v0/shipments", {
    query: {
      ShipmentStatusList: queryStatus,
      QueryType: "SHIPMENT",
    },
  })
}

export async function getInboundShipmentItems(accessToken: string, shipmentId: string) {
  return callSpApi(accessToken, `/fba/inbound/v0/shipments/${shipmentId}/items`)
}

// --- Fulfillment Outbound (MCF) ---

export async function getFulfillmentPreview(accessToken: string, body: any) {
  return callSpApi(accessToken, "/fba/outbound/2020-07-01/fulfillmentOrders/preview", {
    method: "POST",
    body,
  })
}

// --- Reports API (Brand Analytics) ---

export async function createReport(accessToken: string, reportType: string, marketplaceIds: string[], dataStartTime: string, dataEndTime: string) {
  return callSpApi(accessToken, "/reports/2021-06-30/reports", {
    method: "POST",
    body: {
      reportType,
      marketplaceIds,
      dataStartTime,
      dataEndTime,
    },
  })
}

export async function getReport(accessToken: string, reportId: string) {
  return callSpApi(accessToken, `/reports/2021-06-30/reports/${reportId}`)
}

export async function getReportDocument(accessToken: string, reportDocumentId: string) {
  return callSpApi(accessToken, `/reports/2021-06-30/documents/${reportDocumentId}`)
}

// --- Shipping API (Amazon Logistics) ---

export async function getRates(accessToken: string, body: any) {
  return callSpApi(accessToken, "/shipping/v2/shipments/rates", {
    method: "POST",
    body,
  })
}

export async function purchaseShipment(accessToken: string, body: any) {
  return callSpApi(accessToken, "/shipping/v2/shipments", {
    method: "POST",
    body,
  })
}

export async function getTrackingInfo(accessToken: string, trackingId: string, carrierId: string) {
  return callSpApi(accessToken, `/shipping/v2/tracking`, {
    query: { trackingId, carrierId },
  })
}
