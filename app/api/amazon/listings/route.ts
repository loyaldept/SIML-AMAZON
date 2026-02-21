import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, putListingsItem, getListingsItem, deleteListingsItem, searchCatalog } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const sku = searchParams.get("sku")
  const keywords = searchParams.get("keywords")

  try {
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id, seller_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"
    const sellerId = conn?.seller_id || ""

    if (keywords) {
      const results = await searchCatalog(token, keywords, [marketplaceId])
      return NextResponse.json(results)
    }

    if (sku && sellerId) {
      const listing = await getListingsItem(token, sellerId, sku, [marketplaceId])
      return NextResponse.json(listing)
    }

    return NextResponse.json({ error: "Provide sku or keywords" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected. Please connect your Amazon Seller account first." }, { status: 403 })

  try {
    const body = await request.json()
    const { sku, productType, attributes, asin } = body

    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id, seller_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"
    const sellerId = conn?.seller_id

    if (!sellerId) return NextResponse.json({ error: "Seller ID not found. Please reconnect your Amazon account." }, { status: 400 })
    if (!sku) return NextResponse.json({ error: "SKU is required" }, { status: 400 })

    // Build the proper Listings API body.
    // For existing ASINs (most common case), use LISTING_OFFER_ONLY which only requires
    // condition, price, and quantity - not the full product data.
    const listingBody: any = {
      productType: productType || "PRODUCT",
      requirements: "LISTING_OFFER_ONLY",
      attributes: {
        condition_type: attributes?.condition_type || [{ value: "new_new" }],
        merchant_suggested_asin: asin ? [{ value: asin, marketplace_id: marketplaceId }] : undefined,
        purchasable_offer: [{
          marketplace_id: marketplaceId,
          currency: "USD",
          our_price: [{
            schedule: [{
              value_with_tax: attributes?.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax || 0,
            }],
          }],
        }],
        fulfillment_availability: [{
          fulfillment_channel_code: attributes?.fulfillment_availability?.[0]?.fulfillment_channel_code || "DEFAULT",
          quantity: attributes?.fulfillment_availability?.[0]?.quantity || 1,
        }],
      },
    }

    // If item_name is provided (e.g., for new products), include it
    if (attributes?.item_name) {
      listingBody.attributes.item_name = attributes.item_name
    }

    // Remove undefined fields
    if (!listingBody.attributes.merchant_suggested_asin) {
      delete listingBody.attributes.merchant_suggested_asin
    }

    const result = await putListingsItem(token, sellerId, sku, [marketplaceId], listingBody)

    // Check for SP-API issues/errors in the response
    const issues = result?.issues || []
    const hasErrors = issues.some((i: any) => i.severity === "ERROR")

    const listingStatus = hasErrors ? "pending" : "active"

    // Upsert to listings table (avoid duplicates)
    const title = attributes?.item_name?.[0]?.value || sku
    const price = attributes?.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax || 0
    const quantity = attributes?.fulfillment_availability?.[0]?.quantity || 1
    const condition = attributes?.condition_type?.[0]?.value || "new_new"

    const { error: upsertError } = await supabase.from("listings").upsert({
      user_id: user.id,
      title,
      asin: asin || "",
      sku,
      price,
      quantity,
      channel: "Amazon",
      status: listingStatus,
      condition,
    }, { onConflict: "user_id,sku,channel" })

    // If upsert on composite key fails, try simple insert
    if (upsertError) {
      await supabase.from("listings").insert({
        user_id: user.id,
        title,
        asin: asin || "",
        sku,
        price,
        quantity,
        channel: "Amazon",
        status: listingStatus,
        condition,
      })
    }

    // Create notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "listing",
      title: hasErrors ? "Listing submitted with issues" : "Listed on Amazon",
      message: hasErrors
        ? `SKU "${sku}" submitted but has issues: ${issues.map((i: any) => i.message).join("; ")}`
        : `SKU "${sku}" has been listed on Amazon marketplace.`,
    })

    return NextResponse.json({
      ...result,
      listingStatus,
      issues,
    })
  } catch (error: any) {
    console.error("[Listings PUT] Error:", error?.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const sku = searchParams.get("sku")
  if (!sku) return NextResponse.json({ error: "SKU required" }, { status: 400 })

  try {
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id, seller_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const sellerId = conn?.seller_id
    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"

    if (!sellerId) return NextResponse.json({ error: "Seller ID not found" }, { status: 400 })

    const result = await deleteListingsItem(token, sellerId, sku, [marketplaceId])

    // Update listing status in our DB
    await supabase.from("listings").update({ status: "deleted" })
      .eq("user_id", user.id)
      .eq("sku", sku)
      .eq("channel", "Amazon")

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
