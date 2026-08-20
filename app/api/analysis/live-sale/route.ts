import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Backs LiveSaleAnalyticsSection (Live/Log tabs) -- distinct from Sales'
// own analytics (which already covers revenue trends and top items by
// revenue, live_sale_taps included via UNION). This is the tap-specific
// breakdown that view doesn't have: who's tapping, when, and how reliably
// (undo rate), not just how much came in.
export async function GET() {
  try {
    const [dailyTaps30, byStaff30, byHour30, topItemsByCount30, undoStats] = await Promise.all([
      sql`
        SELECT tapped_at::date AS date,
               COUNT(*) FILTER (WHERE NOT undone) AS taps,
               COALESCE(SUM(price * quantity) FILTER (WHERE NOT undone), 0) AS revenue
        FROM live_sale_taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY tapped_at::date
        ORDER BY tapped_at::date
      `,
      sql`
        SELECT staff_name,
               COUNT(*) FILTER (WHERE NOT undone) AS taps,
               COALESCE(SUM(price * quantity) FILTER (WHERE NOT undone), 0) AS revenue
        FROM live_sale_taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY staff_name
        ORDER BY revenue DESC
        LIMIT 10
      `,
      sql`
        SELECT EXTRACT(HOUR FROM tapped_at)::int AS hour,
               COUNT(*) FILTER (WHERE NOT undone) AS taps
        FROM live_sale_taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY hour
        ORDER BY hour
      `,
      sql`
        SELECT item_name,
               COUNT(*) FILTER (WHERE NOT undone) AS taps
        FROM live_sale_taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY item_name
        ORDER BY taps DESC
        LIMIT 10
      `,
      sql`
        SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE undone) AS undone
        FROM live_sale_taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '29 days'
      `,
    ])

    return NextResponse.json({ dailyTaps30, byStaff30, byHour30, topItemsByCount30, undoStats: undoStats[0] ?? { total: 0, undone: 0 } })
  } catch (e) {
    console.error('analysis/live-sale error:', e)
    return NextResponse.json({ dailyTaps30: [], byStaff30: [], byHour30: [], topItemsByCount30: [], undoStats: { total: 0, undone: 0 } })
  }
}
