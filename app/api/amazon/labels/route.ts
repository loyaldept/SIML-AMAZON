import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getLabels } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const shipmentId = searchParams.get("shipmentId")
  const pageType = searchParams.get("pageType") || "PackageLabel_Plain_Paper"
  const labelType = searchParams.get("labelType") || "UNIQUE"

  if (!shipmentId) {
    return NextResponse.json({ error: "shipmentId is required" }, { status: 400 })
  }

  try {
    const result = await getLabels(token, shipmentId, pageType, labelType)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Generate FNSKU labels locally (for products without a shipment yet)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { items, pageType } = body

    // items: Array<{ sku: string, fnsku: string, title: string, condition: string }>
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }

    // Generate a simple PDF label document with FNSKU barcodes
    // This generates an HTML document that can be printed directly
    const labelSize = pageType === "PackageLabel_Letter_6" ? "letter-6" : "plain"

    const labelsHtml = generateFNSKULabelsHtml(items, labelSize)

    return NextResponse.json({
      html: labelsHtml,
      count: items.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generateFNSKULabelsHtml(items: Array<{ sku: string; fnsku?: string; title: string; condition?: string; asin?: string }>, size: string) {
  const labelWidth = size === "letter-6" ? "3.5in" : "3in"
  const labelHeight = size === "letter-6" ? "1.125in" : "1in"

  const labels = items.map(item => {
    const barcode = item.fnsku || item.sku
    const title = item.title.length > 50 ? item.title.substring(0, 47) + "..." : item.title
    const condition = item.condition || "New"

    return `
      <div class="label" style="width: ${labelWidth}; height: ${labelHeight}; border: 1px solid #000; padding: 4px; margin: 4px; display: inline-block; font-family: Arial, sans-serif; overflow: hidden; page-break-inside: avoid;">
        <div style="font-size: 7px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
        <div style="text-align: center; margin: 2px 0;">
          <svg class="barcode" data-value="${barcode}"></svg>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 6px;">
          <span>${barcode}</span>
          <span>${condition}</span>
        </div>
      </div>
    `
  }).join("")

  return `<!DOCTYPE html>
<html>
<head>
  <title>FNSKU Labels</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body { font-family: Arial, sans-serif; padding: 10px; }
    .label { vertical-align: top; }
    .print-btn {
      display: block; margin: 20px auto; padding: 10px 30px;
      background: #1a1a1a; color: white; border: none; border-radius: 8px;
      font-size: 14px; cursor: pointer;
    }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print Labels</button>
  <div id="labels">${labels}</div>
  <script>
    document.querySelectorAll('.barcode').forEach(el => {
      try {
        JsBarcode(el, el.dataset.value, {
          format: "CODE128",
          width: 1.5,
          height: 30,
          displayValue: false,
          margin: 0,
        });
      } catch(e) { console.log('Barcode error:', e); }
    });
  </script>
</body>
</html>`
}
