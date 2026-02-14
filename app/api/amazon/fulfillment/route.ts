import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getInboundShipments, getInboundShipmentItems, getFulfillmentPreview } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const shipmentId = searchParams.get("shipmentId")
  const status = searchParams.get("status") || "WORKING"

  try {
    if (shipmentId) {
      const items = await getInboundShipmentItems(token, shipmentId)
      return NextResponse.json(items)
    }

    const shipments = await getInboundShipments(token, status)
    return NextResponse.json(shipments)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  try {
    const body = await request.json()
    const preview = await getFulfillmentPreview(token, body)
    return NextResponse.json(preview)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
