import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  const apiKey = process.env.KEEPA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Keepa API key not configured" }, { status: 500 })
  }

  try {
    // Keepa product request API
    const keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${encodeURIComponent(query)}&stats=180&history=1&offers=20`

    const response = await fetch(keepaUrl)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] Keepa API error:", response.status, errorText)
      return NextResponse.json({ error: "Keepa API request failed", details: errorText }, { status: response.status })
    }

    const data = await response.json()

    if (!data.products || data.products.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const product = data.products[0]

    // Keepa stores prices in cents, -1 means no data, -2 means out of stock
    const parseCents = (val: number | undefined) => {
      if (val === undefined || val === null || val < 0) return null
      return val / 100
    }

    // Stats object contains current and average pricing
    const stats = product.stats || {}
    const current = stats.current || []
    const avg180 = stats.avg180 || []

    // Keepa csv index: 0=Amazon, 1=New 3rd party, 2=Used, 3=Sales Rank, 7=Buy Box, 10=New offer count, 11=Used offer count, 18=Buy Box New
    const amazonPrice = parseCents(current[0])
    const newPrice = parseCents(current[1])
    const usedPrice = parseCents(current[2])
    const salesRank = current[3] > 0 ? current[3] : null
    const buyBoxPrice = parseCents(current[18] > 0 ? current[18] : current[7])
    const newOfferCount = current[10] > 0 ? current[10] : 0
    const usedOfferCount = current[11] > 0 ? current[11] : 0

    const avg180Amazon = parseCents(avg180[0])
    const avg180New = parseCents(avg180[1])
    const avg180Used = parseCents(avg180[2])
    const avg180SalesRank = avg180[3] > 0 ? avg180[3] : null

    // Build image URL from Keepa image array
    let imageUrl = null
    if (product.imagesCSV) {
      const firstImage = product.imagesCSV.split(",")[0]
      imageUrl = `https://images-na.ssl-images-amazon.com/images/I/${firstImage}`
    }

    const result = {
      asin: product.asin,
      title: product.title,
      imageUrl,
      salesRank,
      salesRankCategory: product.categoryTree?.[0]?.name || product.rootCategory?.toString() || "N/A",
      amazonPrice,
      newPrice,
      usedPrice,
      buyBoxPrice,
      newOfferCount,
      usedOfferCount,
      avg180: {
        amazonPrice: avg180Amazon,
        newPrice: avg180New,
        usedPrice: avg180Used,
        salesRank: avg180SalesRank,
      },
      packageWeight: product.packageWeight ? (product.packageWeight / 100).toFixed(2) + " lbs" : null,
      packageDimensions: product.packageLength
        ? `${(product.packageLength / 100).toFixed(1)} x ${(product.packageWidth / 100).toFixed(1)} x ${(product.packageHeight / 100).toFixed(1)} in`
        : null,
      brand: product.brand || null,
      manufacturer: product.manufacturer || null,
      ean: product.eanList?.[0] || null,
      upc: product.upcList?.[0] || null,
      tokensLeft: data.tokensLeft,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.log("[v0] Keepa fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch product data" }, { status: 500 })
  }
}
