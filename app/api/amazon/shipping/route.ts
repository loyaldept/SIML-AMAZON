import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getRates, purchaseShipment, getTrackingInfo } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const trackingId = searchParams.get("trackingId")
  const carrierId = searchParams.get("carrierId")

  if (!trackingId || !carrierId) {
    return NextResponse.json({ error: "trackingId and carrierId required" }, { status: 400 })
  }

  try {
    const tracking = await getTrackingInfo(token, trackingId, carrierId)
    return NextResponse.json(tracking)
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
    const { action } = body

    if (action === "rates") {
      const rates = await getRates(token, body.shipmentData)
      return NextResponse.json(rates)
    }

    if (action === "purchase") {
      const shipment = await purchaseShipment(token, body.shipmentData)
      return NextResponse.json(shipment)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
