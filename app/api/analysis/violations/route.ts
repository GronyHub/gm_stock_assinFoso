import { NextResponse } from 'next/server'
import { GET as getItems } from '@/app/api/items/route'
import { GET as getFlags } from '@/app/api/flags/route'
import { GET as getDaily } from '@/app/api/stock/daily/route'
import { GET as getOverdue } from '@/app/api/stock/overdue/route'
import { GET as getLossSummary } from '@/app/api/losses/summary/route'

// Reuses the exact same endpoints the live Needs-Attention badges are built
// from (rather than re-deriving the logic here), so this chart can never
// drift out of sync with what staff actually see on the app's own tabs.
export async function GET() {
  try {
    const [itemsRes, flagsRes, dailyRes, overdueRes, lossRes] = await Promise.all([
      getItems(), getFlags(), getDaily(), getOverdue(), getLossSummary(),
    ])
    const [items, flags, daily, overdue, lossSummary] = await Promise.all([
      itemsRes.json(), flagsRes.json(), dailyRes.json(), overdueRes.json(), lossRes.json(),
    ])

    const itemList = Array.isArray(items) ? items : []
    const negSoh = itemList.filter((i: any) => Number(i.calculated_soh) <= 0 && i.product_type !== 'service').length
    const noSp = itemList.filter((i: any) => !i.selling_rate || parseFloat(i.selling_rate) === 0).length
    const noCp = itemList.filter((i: any) => !i.purchase_rate || parseFloat(i.purchase_rate) === 0).length

    const lossList = Array.isArray(lossSummary) ? lossSummary : []
    const serviceViolation = lossList.filter((r: any) =>
      r.product_type === 'service' && (Number(r.cnt) !== 0 || Number(r.gmc) !== 0 || Number(r.bl) !== 0)
    ).length

    const violations = [
      { key: 'neg_soh', label: 'Negative SOH', category: 'Items', count: negSoh },
      { key: 'no_sp', label: 'No Selling Price', category: 'Items', count: noSp },
      { key: 'no_cp', label: 'No Cost Price', category: 'Items', count: noCp },
      { key: 'no_group', label: 'No Group', category: 'Items', count: flags?.noGroup?.length ?? 0 },
      { key: 'duplicates', label: 'Possible Duplicates', category: 'Items', count: flags?.duplicates?.length ?? 0 },
      { key: 'service_violation', label: 'Service Violations', category: 'Items', count: serviceViolation },
      { key: 'no_cash', label: 'No Cash Counted', category: 'Sales', count: flags?.noCash?.length ?? 0 },
      { key: 'missing_days', label: 'Missing Sales Days', category: 'Sales', count: flags?.missingDays?.length ?? 0 },
      { key: 'cost_price', label: 'Cost ≥ Selling Price', category: 'Sales', count: flags?.costGteSell?.length ?? 0 },
      { key: 'dup_receipt', label: 'Duplicate Receipts', category: 'Sales', count: flags?.dupReceipts?.length ?? 0 },
      { key: 'daily_count', label: 'Daily Count Pending', category: 'Counts', count: Array.isArray(daily) ? daily.length : 0 },
      { key: '15day_count', label: '15-Day Count Overdue', category: 'Counts', count: Array.isArray(overdue) ? overdue.length : 0 },
      { key: 'unchecked_cab', label: 'Unchecked Cash at Bank', category: 'Cash', count: flags?.uncheckedCab?.length ?? 0 },
      { key: 'no_staff_times', label: 'No Staff Times', category: 'Staff', count: flags?.noStaffTimes?.length ?? 0 },
    ]

    return NextResponse.json({ violations })
  } catch (e) {
    console.error('violations chart error:', e)
    return NextResponse.json({ error: 'Failed to load violations' }, { status: 500 })
  }
}
