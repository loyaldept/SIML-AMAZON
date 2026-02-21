import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getAllFbaInventory, getMyPrice, getCompetitivePricing, getCatalogItem } from "@/lib/amazon-sp-api"

export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  try {
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"

    // 1. Get all FBA inventory summaries
    const summaries = await getAllFbaInventory(token, [marketplaceId])

    // 2. Get prices for all ASINs (batch in groups of 20)
    const allAsins = [...new Set(summaries.map((s: any) => s.asin).filter(Boolean))]
    const priceMap: Record<string, { price: number; currency: string }> = {}
    const imageMap: Record<string, string> = {}

    // Fetch prices in batches of 20 (API limit)
    for (let i = 0; i < allAsins.length; i += 20) {
      const batch = allAsins.slice(i, i + 20)
      try {
        const priceData: any = await getMyPrice(token, marketplaceId, batch)
        const prices = priceData?.payload || priceData || []
        if (Array.isArray(prices)) {
          for (const p of prices) {
            const asin = p.ASIN || p.asin
            if (p.status === "ClientError" || p.status === "ServerError") continue
            const offer = p.Product?.Offers?.[0]
            const landedPrice = offer?.BuyingPrice?.LandedPrice
            const listingPrice = offer?.BuyingPrice?.ListingPrice
            const regularPrice = offer?.RegularPrice
            const price = landedPrice || listingPrice || regularPrice
            if (asin && price) {
              priceMap[asin] = {
                price: parseFloat(String(price.Amount || "0")),
                currency: price.CurrencyCode || "USD",
              }
            }
          }
        }
      } catch (e: any) {
        console.log("[Inventory] getMyPrice batch error:", e?.message)
      }
    }

    // 2b. For ASINs still missing prices, try competitive pricing as fallback
    const missingPriceAsins = allAsins.filter(a => !priceMap[a])
    if (missingPriceAsins.length > 0) {
      for (let i = 0; i < missingPriceAsins.length; i += 20) {
        const batch = missingPriceAsins.slice(i, i + 20)
        try {
          const compData: any = await getCompetitivePricing(token, marketplaceId, batch)
          const items = compData?.payload || compData || []
          if (Array.isArray(items)) {
            for (const item of items) {
              const asin = item.ASIN || item.asin
              if (item.status === "ClientError" || item.status === "ServerError") continue
              const competitivePrices = item.Product?.CompetitivePricing?.CompetitivePrices || []
              // CompetitivePriceId "1" = New Buy Box price
              const buyBoxPrice = competitivePrices.find((cp: any) => cp.CompetitivePriceId === "1")
              const price = buyBoxPrice?.Price?.LandedPrice || buyBoxPrice?.Price?.ListingPrice
              if (asin && price) {
                priceMap[asin] = {
                  price: parseFloat(String(price.Amount || "0")),
                  currency: price.CurrencyCode || "USD",
                }
              }
            }
          }
        } catch (e: any) {
          console.log("[Inventory] competitive pricing fallback error:", e?.message)
        }
      }
    }

    // 3. Get images for up to 50 ASINs via Catalog API
    for (let i = 0; i < Math.min(allAsins.length, 50); i++) {
      try {
        const catalogData: any = await getCatalogItem(token, allAsins[i], [marketplaceId])
        const images = catalogData?.images?.[0]?.images || []
        if (images.length > 0) {
          imageMap[allAsins[i]] = images[0].link || ""
        }
      } catch {
        // Skip image fetch errors silently
      }
    }

    // 4. Sync to inventory table with prices and images
    const results = []
    for (const item of summaries) {
      const asin = item.asin
      const qty = item.inventoryDetails?.fulfillableQuantity || item.totalQuantity || 0
      const priceInfo = priceMap[asin]
      const image = imageMap[asin]

      const upsertData: any = {
        user_id: user.id,
        asin: item.asin,
        sku: item.sellerSku || item.asin,
        title: item.productName || item.sellerSku || item.asin,
        quantity: qty,
        channel: "FBA",
        status: qty > 0 ? "active" : "out_of_stock",
        fulfillment_channel: "FBA",
        fnsku: item.fnSku || null,
        updated_at: new Date().toISOString(),
      }

      // Only set price if we got one from any API
      if (priceInfo) {
        upsertData.price = priceInfo.price
      }

      // Only set image if we got one
      if (image) {
        upsertData.image_url = image
      }

      await supabase.from("inventory").upsert(upsertData, { onConflict: "user_id,asin" })

      results.push({
        asin: item.asin,
        sku: item.sellerSku,
        title: item.productName,
        quantity: qty,
        price: priceInfo?.price || null,
        image: image || null,
        fnsku: item.fnSku,
      })
    }

    return NextResponse.json({
      inventorySummaries: results,
      totalSkus: results.length,
      totalUnits: results.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0),
      pricesFound: Object.keys(priceMap).length,
      imagesFound: Object.keys(imageMap).length,
    })
  } catch (error: any) {
    console.error("[Inventory] API error:", error?.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
