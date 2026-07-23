import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { ensureCountRevisions } from '@/lib/countRevisions'
import { getItemDayRows, type ItemDayRow } from '@/lib/itemDayRows'
import { computeChainLossSummary } from '@/lib/packChain'

export const dynamic = 'force-dynamic'

type ItemMeta = {
  item_id: number
  item_name: string
  cf_group: string | null
  calculated_soh: string | null
  selling_rate: string | null
  purchase_rate: string | null
  product_type: string | null
  units_per_pack: string | null
  converts_to_item_id: number | null
}

function n(v: string | null) { return parseFloat(v ?? '0') || 0 }

// Mirrors /api/losses/summary's aggregateItem -- kept as its own small copy
// rather than shared, since it's a pure numeric reducer too small to be
// worth threading through a shared module.
function aggregateItem(rows: ItemDayRow[], sp: number) {
  let prev: number | null = null
  let lgQty = 0, gainQty = 0, cnt = 0, wic = 0, gmc = 0, bl = 0, cnv = 0, lossCount = 0
  for (const row of rows) {
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    const bills = n(row.bills_qty), w = n(row.wic_qty), g = n(row.gmc_qty), c = n(row.converted_in_qty)
    if (prev === null) {
      if (counted !== null) prev = counted
    } else {
      const expected: number = prev + bills + c - w - g
      if (counted !== null) {
        const diff = expected - counted
        lgQty += diff
        if (diff > 0.0001) lossCount++
        else if (diff < -0.0001) gainQty += -diff
        prev = counted
      }
      else prev = expected
    }
    if (counted !== null) cnt += counted
    wic += w; gmc += g; bl += bills; cnv += c
  }
  return {
    lgQty: parseFloat(lgQty.toFixed(4)),
    lgAmt: parseFloat((lgQty * sp).toFixed(2)),
    lossCount,
    gainAmt: parseFloat((gainQty * sp).toFixed(2)),
    cnt: parseFloat(cnt.toFixed(4)),
    wic: parseFloat(wic.toFixed(4)),
    gmc: parseFloat(gmc.toFixed(4)),
    bl: parseFloat(bl.toFixed(4)),
    cnv: parseFloat(cnv.toFixed(4)),
  }
}

const PAPER_SELL_PRICE = 20

async function loadMeta(id: number): Promise<ItemMeta | null> {
  const [row] = await sql`
    SELECT s.item_id, COALESCE(i.canonical_name, s.item_name) AS item_name, s.cf_group, s.calculated_soh,
           i.selling_rate, i.purchase_rate, i.product_type, i.units_per_pack, i.converts_to_item_id
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_id = ${id}
  ` as unknown as ItemMeta[]
  return row ?? null
}

// Single-item version of /api/losses/summary's per-item aggregation -- used
// by ItemDetailDropdown (the inline item drop-down on Sales/Bills)
// so tapping one item doesn't trigger that route's whole-shop computation.
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: itemIdStr } = await params
  const itemId = Number(itemIdStr)
  if (!Number.isFinite(itemId)) return NextResponse.json({ error: 'Invalid item id' }, { status: 400 })

  const item = await loadMeta(itemId)
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const target = item.converts_to_item_id != null ? await loadMeta(item.converts_to_item_id) : null

  // ₵ valuation override for the 4x6 paper chain -- matches /api/losses/summary.
  const isPaperPack = item.converts_to_item_id != null
    && (item.product_type ?? 'goods') !== 'service'
    && /4x6/i.test(item.item_name) && /pack/i.test(item.item_name)
  const sp = isPaperPack
    ? (parseFloat(item.units_per_pack ?? '0') || 1) * PAPER_SELL_PRICE
    : parseFloat(item.selling_rate ?? '0') || 0

  await ensureCountRevisions()
  const dayRows = await getItemDayRows(itemId)
  const agg = aggregateItem(dayRows, sp)

  const isPackChain = (item.product_type ?? 'goods') !== 'service' && item.converts_to_item_id != null && target
  if (isPackChain && target) {
    const singlesDayRows = await getItemDayRows(target.item_id)
    const singlesSp = parseFloat(target.selling_rate ?? '0') || 0
    const sheetPrice = singlesSp > 0 ? singlesSp : PAPER_SELL_PRICE
    const unitsPerPack = parseFloat(item.units_per_pack ?? '0') || 0
    const chain = computeChainLossSummary(dayRows, singlesDayRows, unitsPerPack, sheetPrice)
    agg.lgAmt = chain.lossAmt
    agg.lossCount = chain.lossCount
    agg.gainAmt = chain.gainAmt
  }

  return NextResponse.json({
    item_id: item.item_id,
    item_name: item.item_name,
    cf_group: item.cf_group,
    product_type: item.product_type,
    soh: item.calculated_soh,
    sp: item.selling_rate,
    cp: item.purchase_rate,
    units_per_pack: item.units_per_pack,
    converts_to_item_id: item.converts_to_item_id,
    converts_to_item_name: target?.item_name ?? null,
    ...agg,
  })
}
