import { NextResponse } from "next/server"

// In-memory cache for product lookups (survives across requests in the same serverless instance)
const productCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCached(key: string) {
  const entry = productCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    productCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: any) {
  // Evict old entries if cache gets too big
  if (productCache.size > 200) {
    const oldest = productCache.keys().next().value
    if (oldest) productCache.delete(oldest)
  }
  productCache.set(key, { data, timestamp: Date.now() })
}

// Detect query type: ISBN-13 (978/979), ISBN-10, UPC, EAN, or ASIN
function detectQueryType(query: string): "isbn" | "upc" | "ean" | "asin" {
  const cleaned = query.replace(/[-\s]/g, "")
  if (/^(978|979)\d{10}$/.test(cleaned)) return "isbn"
  if (/^\d{13}$/.test(cleaned)) return "ean"
  if (/^\d{12}$/.test(cleaned)) return "upc"
  if (/^\d{9}[\dXx]$/.test(cleaned)) return "isbn"
  return "asin"
}

// Fetch with timeout to avoid hanging requests
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
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

    // Check cache first
    const cacheKey = `${queryType}:${cleaned}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Use stats=180 only (no history=1 or offers=20 — they add massive payload and latency)
    let keepaUrl: string
    if (queryType === "asin") {
      keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${encodeURIComponent(cleaned)}&stats=180&offers=0`
    } else {
      keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&code=${encodeURIComponent(cleaned)}&stats=180&offers=0`
    }

    const response = await fetchWithTimeout(keepaUrl)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[Keepa] API error:", response.status, errorText)
      return NextResponse.json({ error: "Keepa API request failed", details: errorText }, { status: response.status })
    }

    const data = await response.json()

    if (!data.products || data.products.length === 0) {
      // Fallback: search by keyword, but only fetch lightweight stats for the matched ASIN
      if (queryType !== "asin") {
        const fallbackUrl = `https://api.keepa.com/search?key=${apiKey}&domain=1&type=product&term=${encodeURIComponent(cleaned)}`
        const fallbackRes = await fetchWithTimeout(fallbackUrl, 6000)
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          if (fallbackData.asinList && fallbackData.asinList.length > 0) {
            const asin = fallbackData.asinList[0]
            const productUrl = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${asin}&stats=180&offers=0`
            const productRes = await fetchWithTimeout(productUrl)
            if (productRes.ok) {
              const productData = await productRes.json()
              if (productData.products && productData.products.length > 0) {
                const result = buildProductResponse(productData, queryType, cleaned)
                const body = await result.json()
                setCache(cacheKey, body)
                return NextResponse.json(body)
              }
            }
          }
        }
      }
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const result = buildProductResponse(data, queryType, cleaned)
    const body = await result.json()
    setCache(cacheKey, body)
    return NextResponse.json(body)
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return NextResponse.json({ error: "Product lookup timed out. Try again." }, { status: 504 })
    }
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
