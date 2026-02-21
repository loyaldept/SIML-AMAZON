import { NextResponse } from "next/server"

// Detect query type: ISBN-13 (978/979), ISBN-10, UPC, EAN, or ASIN
function detectQueryType(query: string): "isbn" | "upc" | "ean" | "asin" {
  const cleaned = query.replace(/[-\s]/g, "")
  // ISBN-13: starts with 978 or 979, 13 digits
  if (/^(978|979)\d{10}$/.test(cleaned)) return "isbn"
  // EAN-13: 13 digits (not starting with 978/979 already covered above)
  if (/^\d{13}$/.test(cleaned)) return "ean"
  // UPC: 12 digits
  if (/^\d{12}$/.test(cleaned)) return "upc"
  // ISBN-10: 10 chars (digits, last may be X)
  if (/^\d{9}[\dXx]$/.test(cleaned)) return "isbn"
  // ASIN: starts with B0 or is 10 alphanumeric chars
  return "asin"
}

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
    const cleaned = query.trim().replace(/[-\s]/g, "")
    const queryType = detectQueryType(cleaned)

    let keepaUrl: string

    if (queryType === "isbn" || queryType === "ean") {
      // Use Keepa product search by EAN/ISBN code - Keepa treats ISBN-13 as EAN
      keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&code=${encodeURIComponent(cleaned)}&stats=180&history=1&offers=20`
    } else if (queryType === "upc") {
      // Use Keepa product search by UPC code
      keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&code=${encodeURIComponent(cleaned)}&stats=180&history=1&offers=20`
    } else {
      // ASIN lookup
      keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${encodeURIComponent(cleaned)}&stats=180&history=1&offers=20`
    }

    const response = await fetch(keepaUrl)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[Keepa] API error:", response.status, errorText)
      return NextResponse.json({ error: "Keepa API request failed", details: errorText }, { status: response.status })
    }

    const data = await response.json()

    if (!data.products || data.products.length === 0) {
      // If code-based lookup failed, try a search by keyword as fallback
      if (queryType !== "asin") {
        const fallbackUrl = `https://api.keepa.com/search?key=${apiKey}&domain=1&type=product&term=${encodeURIComponent(cleaned)}`
        const fallbackRes = await fetch(fallbackUrl)
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          if (fallbackData.asinList && fallbackData.asinList.length > 0) {
            // Re-fetch product data for the first matched ASIN
            const asin = fallbackData.asinList[0]
            const productUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${asin}&stats=180&history=1&offers=20`
            const productRes = await fetch(productUrl)
            if (productRes.ok) {
              const productData = await productRes.json()
              if (productData.products && productData.products.length > 0) {
                return buildProductResponse(productData, queryType, cleaned)
              }
            }
          }
        }
      }
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return buildProductResponse(data, queryType, cleaned)
  } catch (error) {
    console.log("[Keepa] fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch product data" }, { status: 500 })
  }
}

function buildProductResponse(data: any, queryType: string, originalQuery: string) {
  const product = data.products[0]

  // Keepa stores prices in cents, -1 means no data, -2 means out of stock
  const parseCents = (val: number | undefined) => {
    if (val === undefined || val === null || val < 0) return null
    return val / 100
  }

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
    isbn: product.eanList?.find((e: string) => e?.startsWith("978") || e?.startsWith("979")) || null,
    ean: product.eanList?.[0] || null,
    upc: product.upcList?.[0] || null,
    tokensLeft: data.tokensLeft,
  }

  return NextResponse.json(result)
}
