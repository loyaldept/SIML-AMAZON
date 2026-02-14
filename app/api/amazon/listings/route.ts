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
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  try {
    const body = await request.json()
    const { sku, productType, attributes } = body

    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id, seller_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"
    const sellerId = conn?.seller_id

    if (!sellerId) return NextResponse.json({ error: "Seller ID not found" }, { status: 400 })

    const result = await putListingsItem(token, sellerId, sku, [marketplaceId], {
      productType,
      requirements: "LISTING",
      attributes,
    })

    // Save to our listings table
    await supabase.from("listings").insert({
      user_id: user.id,
      title: attributes?.item_name?.[0]?.value || sku,
      asin: attributes?.asin || "",
      sku,
      price: attributes?.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax || 0,
      quantity: attributes?.fulfillment_availability?.[0]?.quantity || 1,
      channel: "Amazon",
      status: "active",
      condition: attributes?.condition_type?.[0]?.value || "new_new",
    })

    // Create notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "listing",
      title: "Listed on Amazon",
      message: `SKU "${sku}" has been listed on Amazon marketplace.`,
    })

    return NextResponse.json(result)
  } catch (error: any) {
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
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
