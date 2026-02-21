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
  const isLetter6 = size === "letter-6"

  // Generate a summary table first so users know which label is which
  const summaryRows = items.map((item, idx) => {
    const barcode = item.fnsku || item.sku
    return `<tr>
      <td style="padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px; color: #666;">${idx + 1}</td>
      <td style="padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px;">${item.title}</td>
      <td style="padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px; font-family: monospace;">${item.sku}</td>
      <td style="padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px; font-family: monospace;">${barcode}</td>
      <td style="padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px;">${item.asin || "—"}</td>
      <td style="padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px;">${item.condition || "New"}</td>
    </tr>`
  }).join("")

  // Generate individual labels - each on its own row with clear identification
  const labels = items.map((item, idx) => {
    const barcode = item.fnsku || item.sku
    const title = item.title.length > 60 ? item.title.substring(0, 57) + "..." : item.title
    const condition = item.condition || "New"
    const labelW = isLetter6 ? "3.5in" : "3.5in"
    const labelH = isLetter6 ? "1.25in" : "1.15in"

    return `
      <div class="label-wrapper" style="page-break-inside: avoid; margin-bottom: 12px;">
        <div class="label-id no-print" style="font-size: 10px; color: #999; margin-bottom: 2px; font-family: Arial, sans-serif;">
          Label #${idx + 1} — SKU: ${item.sku}${item.asin ? ` | ASIN: ${item.asin}` : ""} | ${condition}
        </div>
        <div class="label" style="width: ${labelW}; height: ${labelH}; border: 1px solid #000; padding: 6px 8px; font-family: Arial, sans-serif; overflow: hidden; box-sizing: border-box;">
          <div style="font-size: 8px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${title}</div>
          <div style="text-align: center; margin: 3px 0;">
            <svg class="barcode" data-value="${barcode}"></svg>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 7px; margin-top: 2px;">
            <span style="font-weight: bold; font-family: monospace; letter-spacing: 0.5px;">${barcode}</span>
            <span style="color: #333;">${condition}</span>
          </div>
        </div>
      </div>
    `
  }).join("")

  return `<!DOCTYPE html>
<html>
<head>
  <title>FNSKU Labels — ${items.length} Product${items.length !== 1 ? "s" : ""}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .label-wrapper { margin-bottom: 8px; }
    }
    @media screen {
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: #f9f9f9; }
    }
    .header { background: #1a1a1a; color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { font-size: 18px; margin: 0 0 4px 0; }
    .header p { font-size: 12px; margin: 0; opacity: 0.7; }
    .summary-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-table th { padding: 8px; text-align: left; font-size: 11px; background: #f5f5f5; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e0e0e0; }
    .print-btn {
      display: inline-block; margin: 0 8px 20px 0; padding: 10px 24px;
      background: #1a1a1a; color: white; border: none; border-radius: 8px;
      font-size: 14px; cursor: pointer; text-decoration: none;
    }
    .print-btn:hover { background: #333; }
    .print-btn.secondary { background: white; color: #1a1a1a; border: 1px solid #ddd; }
    .print-btn.secondary:hover { background: #f5f5f5; }
    .labels-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .labels-title { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="header no-print">
    <h1>FNSKU Product Labels</h1>
    <p>${items.length} label${items.length !== 1 ? "s" : ""} generated — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </div>

  <div class="no-print">
    <button class="print-btn" onclick="window.print()">Print All Labels</button>
  </div>

  <div class="no-print" style="margin-bottom: 24px;">
    <div class="labels-title" style="padding: 0 0 8px 0; font-size: 13px; font-weight: bold;">Label Summary — Which label is for which product</div>
    <table class="summary-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Product Title</th>
          <th>SKU</th>
          <th>FNSKU / Barcode</th>
          <th>ASIN</th>
          <th>Condition</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>

  <div class="labels-section">
    <div class="labels-title no-print">Printable Labels</div>
    ${labels}
  </div>

  <script>
    document.querySelectorAll('.barcode').forEach(el => {
      try {
        JsBarcode(el, el.dataset.value, {
          format: "CODE128",
          width: 1.8,
          height: 35,
          displayValue: false,
          margin: 0,
        });
      } catch(e) { console.log('Barcode error:', e); }
    });
  <\/script>
</body>
</html>`
}
