import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAmazonToken,
  getInboundShipments,
  getInboundShipmentItems,
  createInboundShipmentPlan,
  createInboundShipment,
  getLabels,
} from "@/lib/amazon-sp-api"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const shipmentId = searchParams.get("shipmentId")
  const statusFilter = searchParams.get("status") || "WORKING,SHIPPED,RECEIVING,CLOSED"
  const action = searchParams.get("action")

  try {
    // Get labels for a shipment
    if (action === "labels" && shipmentId) {
      const pageType = searchParams.get("pageType") || "PackageLabel_Plain_Paper"
      const labelType = searchParams.get("labelType") || "UNIQUE"
      const labels = await getLabels(token, shipmentId, pageType, labelType)
      return NextResponse.json(labels)
    }

    // Get items in a specific shipment
    if (shipmentId) {
      const items = await getInboundShipmentItems(token, shipmentId)
      return NextResponse.json(items)
    }

    // Get all inbound shipments across statuses
    const statuses = statusFilter.split(",").map(s => s.trim())
    const allShipments: any[] = []

    for (const status of statuses) {
      try {
        const result = await getInboundShipments(token, status)
        const shipments = result?.payload?.ShipmentData || []
        allShipments.push(...shipments)
      } catch (e: any) {
        console.log(`[Fulfillment] Status ${status}:`, e?.message)
      }
    }

    return NextResponse.json({
      shipments: allShipments,
      total: allShipments.length,
    })
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

    // Step 1: Create shipment plan (Amazon decides where to send)
    if (action === "createPlan") {
      const plan = await createInboundShipmentPlan(token, {
        ShipFromAddress: body.shipFromAddress,
        InboundShipmentPlanRequestItems: body.items,
        LabelPrepPreference: body.labelPrepPreference || "SELLER_LABEL",
      })
      return NextResponse.json(plan)
    }

    // Step 2: Create actual shipment from plan
    if (action === "createShipment") {
      const result = await createInboundShipment(token, body.shipmentId, {
        InboundShipmentHeader: body.header,
        InboundShipmentItems: body.items,
      })

      // Create notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "shipment",
        title: "Inbound Shipment Created",
        message: `Shipment ${body.shipmentId} created for ${body.header.DestinationFulfillmentCenterId}`,
      })

      return NextResponse.json(result)
    }

    // Get labels for a shipment
    if (action === "getLabels") {
      const labels = await getLabels(
        token,
        body.shipmentId,
        body.pageType || "PackageLabel_Plain_Paper",
        body.labelType || "UNIQUE"
      )
      return NextResponse.json(labels)
    }

    return NextResponse.json({ error: "Invalid action. Use: createPlan, createShipment, getLabels" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
