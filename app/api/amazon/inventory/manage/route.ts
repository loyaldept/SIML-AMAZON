import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAmazonToken,
  getMyFeesEstimate,
  patchListingsItem,
  requestInventoryReport,
  getReport,
  getReportDocument,
  getCatalogItem,
} from "@/lib/amazon-sp-api"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  try {
    const body = await request.json()
    const { action } = body

    const { data: conn } = await supabase
      .from("channel_connections")
      .select("seller_id, marketplace_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const sellerId = conn?.seller_id || ""
    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"

    // Get FBA fee estimates for a product (helps sellers calculate profitability)
    if (action === "getFees") {
      const { asin, price } = body
      if (!asin || !price) return NextResponse.json({ error: "asin and price are required" }, { status: 400 })

      const result = await getMyFeesEstimate(token, asin, price)
      return NextResponse.json(result)
    }

    // Quick quantity update via Listings API PATCH
    if (action === "updateQuantity") {
      const { sku, quantity, fulfillmentChannel } = body
      if (!sku || quantity === undefined) return NextResponse.json({ error: "sku and quantity required" }, { status: 400 })

      const channelCode = fulfillmentChannel === "FBA" ? "AMAZON_NA" : "DEFAULT"
      const result = await patchListingsItem(token, sellerId, sku, [marketplaceId], [
        {
          op: "replace",
          path: "/attributes/fulfillment_availability",
          value: [{
            fulfillment_channel_code: channelCode,
            quantity: quantity,
          }],
        },
      ])

      // Update local DB
      await supabase.from("inventory")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("sku", sku)

      return NextResponse.json(result)
    }

    // Quick price update via Listings API PATCH
    if (action === "updatePrice") {
      const { sku, price } = body
      if (!sku || !price) return NextResponse.json({ error: "sku and price required" }, { status: 400 })

      const result = await patchListingsItem(token, sellerId, sku, [marketplaceId], [
        {
          op: "replace",
          path: "/attributes/purchasable_offer",
          value: [{
            our_price: [{ schedule: [{ value_with_tax: price }] }],
            marketplace_id: marketplaceId,
          }],
        },
      ])

      // Update local DB
      await supabase.from("inventory")
        .update({ price, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("sku", sku)

      return NextResponse.json(result)
    }

    // Request a restock recommendations report
    if (action === "requestRestockReport") {
      const result = await requestInventoryReport(
        token,
        "GET_RESTOCK_INVENTORY_RECOMMENDATIONS_REPORT",
        [marketplaceId]
      )
      return NextResponse.json(result)
    }

    // Request stranded inventory report
    if (action === "requestStrandedReport") {
      const result = await requestInventoryReport(
        token,
        "GET_STRANDED_INVENTORY_UI_DATA",
        [marketplaceId]
      )
      return NextResponse.json(result)
    }

    // Request inventory age report (long-term storage fee planning)
    if (action === "requestAgeReport") {
      const result = await requestInventoryReport(
        token,
        "GET_FBA_INVENTORY_AGED_DATA",
        [marketplaceId]
      )
      return NextResponse.json(result)
    }

    // Check report status
    if (action === "getReportStatus") {
      const { reportId } = body
      if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 })
      const result = await getReport(token, reportId)
      return NextResponse.json(result)
    }

    // Download report document
    if (action === "getReportDocument") {
      const { reportDocumentId } = body
      if (!reportDocumentId) return NextResponse.json({ error: "reportDocumentId required" }, { status: 400 })
      const result = await getReportDocument(token, reportDocumentId)
      return NextResponse.json(result)
    }

    // Bulk delete inventory items (local only - removes from our DB)
    if (action === "bulkDelete") {
      const { ids } = body
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "ids array is required" }, { status: 400 })
      }

      const { error } = await supabase
        .from("inventory")
        .delete()
        .eq("user_id", user.id)
        .in("id", ids)

      if (error) throw error
      return NextResponse.json({ deleted: ids.length })
    }

    // Bulk status change
    if (action === "bulkUpdateStatus") {
      const { ids, status } = body
      if (!ids || !Array.isArray(ids) || !status) {
        return NextResponse.json({ error: "ids array and status required" }, { status: 400 })
      }

      const { error } = await supabase
        .from("inventory")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("id", ids)

      if (error) throw error
      return NextResponse.json({ updated: ids.length })
    }

    // Get product details (catalog + fees in one call)
    if (action === "getProductDetails") {
      const { asin, price } = body
      if (!asin) return NextResponse.json({ error: "asin required" }, { status: 400 })

      const [catalog, fees] = await Promise.allSettled([
        getCatalogItem(token, asin, [marketplaceId]),
        price ? getMyFeesEstimate(token, asin, price) : Promise.resolve(null),
      ])

      return NextResponse.json({
        catalog: catalog.status === "fulfilled" ? catalog.value : null,
        fees: fees.status === "fulfilled" ? fees.value : null,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("[Inventory Manage] error:", error?.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
