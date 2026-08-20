import { computeLossEvents } from '@/lib/lossEvents'
import { NextResponse } from 'next/server'

// Backs LossFeedAnalyticsSection (the Loss by Date tab) -- same event set
// LossFeedTab itself lists day by day, aggregated here instead into a
// 30-day trend and the items actually driving it.
export async function GET() {
  try {
    const events = await computeLossEvents()

    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - 29)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const recent = events.filter(e => e.date >= cutoffStr)

    const byDate = new Map<string, { loss: number; gain: number }>()
    for (const e of recent) {
      const row = byDate.get(e.date) ?? { loss: 0, gain: 0 }
      if (e.kind === 'loss') row.loss += e.loss_amt
      else row.gain += e.loss_amt
      byDate.set(e.date, row)
    }
    const dailyTrend30 = Array.from(byDate.entries())
      .map(([date, v]) => ({ date, loss: Math.round(v.loss * 100) / 100, gain: Math.round(v.gain * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const byItem = new Map<string, number>()
    for (const e of recent) {
      if (e.kind !== 'loss') continue
      byItem.set(e.item_name, (byItem.get(e.item_name) ?? 0) + e.loss_amt)
    }
    const topLossItems30 = Array.from(byItem.entries())
      .map(([item_name, amt]) => ({ item_name, amt: Math.round(amt * 100) / 100 }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 10)

    const totalLoss30 = Math.round(recent.filter(e => e.kind === 'loss').reduce((s, e) => s + e.loss_amt, 0) * 100) / 100
    const totalGain30 = Math.round(recent.filter(e => e.kind === 'gain').reduce((s, e) => s + e.loss_amt, 0) * 100) / 100
    const lossCount30 = recent.filter(e => e.kind === 'loss').length
    const gainCount30 = recent.filter(e => e.kind === 'gain').length

    return NextResponse.json({ dailyTrend30, topLossItems30, totalLoss30, totalGain30, lossCount30, gainCount30 })
  } catch (e) {
    console.error('analysis/loss-feed error:', e)
    return NextResponse.json({ dailyTrend30: [], topLossItems30: [], totalLoss30: 0, totalGain30: 0, lossCount30: 0, gainCount30: 0 })
  }
}
