import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, createReport, getReport, getReportDocument } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get("reportId")
  const documentId = searchParams.get("documentId")

  try {
    if (documentId) {
      const doc = await getReportDocument(token, documentId)
      return NextResponse.json(doc)
    }

    if (reportId) {
      const report = await getReport(token, reportId)
      return NextResponse.json(report)
    }

    return NextResponse.json({ error: "Provide reportId or documentId" }, { status: 400 })
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
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("marketplace_id")
      .eq("user_id", user.id)
      .eq("channel", "Amazon")
      .single()

    const marketplaceId = conn?.marketplace_id || "ATVPDKIKX0DER"

    const report = await createReport(
      token,
      body.reportType || "GET_SALES_AND_TRAFFIC_REPORT",
      [marketplaceId],
      body.dataStartTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      body.dataEndTime || new Date().toISOString()
    )
    return NextResponse.json(report)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
