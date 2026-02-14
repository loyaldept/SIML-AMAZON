import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAmazonToken, getFinancialEventGroups, getFinancialEvents } from "@/lib/amazon-sp-api"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getAmazonToken(user.id)
  if (!token) return NextResponse.json({ error: "Amazon not connected" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get("orderId")

  try {
    if (orderId) {
      const events = await getFinancialEvents(token, orderId)
      return NextResponse.json(events)
    }

    const groups = await getFinancialEventGroups(token)

    // Sync financial data
    if (groups?.payload?.FinancialEventGroupList) {
      for (const group of groups.payload.FinancialEventGroupList.slice(0, 20)) {
        await supabase.from("financial_events").upsert({
          user_id: user.id,
          event_group_id: group.FinancialEventGroupId,
          event_type: "settlement",
          amount: group.ConvertedTotal?.CurrencyAmount ? parseFloat(group.ConvertedTotal.CurrencyAmount) : 0,
          currency: group.ConvertedTotal?.CurrencyCode || "USD",
          posted_at: group.FinancialEventGroupStart,
          raw_data: group,
        }, { onConflict: "user_id,event_group_id" })
      }
    }

    return NextResponse.json(groups)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
