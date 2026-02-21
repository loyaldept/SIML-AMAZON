import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Direct connect using the stored refresh token - exchanges it for an access token
// and stores the connection + fetches seller info
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = process.env.AMAZON_SP_CLIENT_ID
  const clientSecret = process.env.AMAZON_SP_CLIENT_SECRET
  const refreshToken = process.env.AMAZON_SP_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({ error: "Amazon SP-API credentials not configured" }, { status: 500 })
  }

  try {
    // Step 1: Exchange refresh token for access token via LWA
    const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.log("[v0] LWA token exchange failed:", err)
      return NextResponse.json({ error: "Failed to authenticate with Amazon", details: err }, { status: 400 })
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in || 3600

    // Step 2: Fetch seller info using the access token
    let sellerInfo: any = null
    try {
      const sellerRes = await fetch(
        "https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations",
        {
          headers: {
            "x-amz-access-token": accessToken,
            "Content-Type": "application/json",
          },
        }
      )
      if (sellerRes.ok) {
        sellerInfo = await sellerRes.json()
      } else {
        console.log("[v0] Seller info fetch status:", sellerRes.status, await sellerRes.text())
      }
    } catch (e: any) {
      console.log("[v0] Seller info fetch error:", e.message)
    }

    // Extract seller name and marketplace info from Marketplace Participations response
    // Response format: { payload: [{ marketplace: { id, name, countryCode, ... }, participation: { isParticipating, ... } }] }
    const participations = sellerInfo?.payload || []
    const usParticipation = participations.find(
      (p: any) => p.marketplace?.id === "ATVPDKIKX0DER"
    ) || participations[0]
    const storeName = usParticipation?.marketplace?.name || "Amazon Seller"
    const marketplaceId = usParticipation?.marketplace?.id || "ATVPDKIKX0DER"
    // Seller ID is not in the Marketplace Participations response — use env var or extract from orders
    const sellerId = process.env.AMAZON_SELLER_ID || null

    // Step 3: Store connection in Supabase
    const { error: upsertError } = await supabase.from("channel_connections").upsert(
      {
        user_id: user.id,
        channel: "Amazon",
        connected: true,
        status: "connected",
        store_name: storeName,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        marketplace_id: marketplaceId,
        seller_id: sellerId,
        credentials: {
          marketplace_participations: participations.map((p: any) => ({
            marketplace_id: p.marketplace?.id,
            country: p.marketplace?.countryCode,
            name: p.marketplace?.name,
          })),
          connected_at: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,channel" }
    )

    if (upsertError) {
      console.log("[v0] Upsert error:", upsertError)
      return NextResponse.json({ error: "Failed to save connection", details: upsertError.message }, { status: 500 })
    }

    // Step 4: Create notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "channel",
      title: "Amazon Connected",
      message: `Successfully connected to ${storeName}. Your seller data is now syncing.`,
    })

    // Step 5: Try to sync recent orders and extract seller ID from order data if needed
    let orderCount = 0
    let extractedSellerId = sellerId
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const ordersRes = await fetch(
        `https://sellingpartnerapi-na.amazon.com/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${thirtyDaysAgo}&MaxResultsPerPage=20`,
        {
          headers: {
            "x-amz-access-token": accessToken,
            "Content-Type": "application/json",
            "User-Agent": "SIML-Listing/1.0",
          },
        }
      )
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        const orders = ordersData?.payload?.Orders || []
        orderCount = orders.length

        // Try to extract seller ID from order data if we don't have one
        if (!extractedSellerId && orders.length > 0) {
          extractedSellerId = orders[0]?.SellerOrderId?.split("-")?.[0] || null
        }

        for (const order of orders.slice(0, 20)) {
          await supabase.from("orders").upsert({
            user_id: user.id,
            amazon_order_id: order.AmazonOrderId,
            status: order.OrderStatus,
            total_amount: order.OrderTotal?.Amount ? parseFloat(order.OrderTotal.Amount) : 0,
            currency: order.OrderTotal?.CurrencyCode || "USD",
            items_count: (order.NumberOfItemsUnshipped || 0) + (order.NumberOfItemsShipped || 0),
            buyer_email: order.BuyerInfo?.BuyerEmail || null,
            order_date: order.PurchaseDate,
            channel: "Amazon",
            raw_data: order,
          }, { onConflict: "user_id,amazon_order_id" })
        }
      }
    } catch (e: any) {
      console.log("[v0] Order sync error:", e.message)
    }

    // Update seller_id if we extracted one from orders
    if (extractedSellerId && extractedSellerId !== sellerId) {
      await supabase.from("channel_connections")
        .update({ seller_id: extractedSellerId })
        .eq("user_id", user.id)
        .eq("channel", "Amazon")
    }

    return NextResponse.json({
      success: true,
      store_name: storeName,
      marketplace_id: marketplaceId,
      seller_id: extractedSellerId || sellerId,
      orders_synced: orderCount,
      participations: participations,
    })
  } catch (error: any) {
    console.log("[v0] Connect error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
