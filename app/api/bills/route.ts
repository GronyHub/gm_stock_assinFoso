import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureBillAttachmentsColumn } from '@/lib/billAttachments'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  await ensureDbInitialized()
  await ensureBillAttachmentsColumn()

  const url = new URL(req.url)
  // BillsTab fetches this with no limit/offset -- it wants every bill (it
  // derives its year/vendor filters from the full list), so a low default
  // silently hid everything older than the cap. Only an explicit ?limit
  // caps the result now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  try {
    const rows = await sql`
      SELECT id, bill_number, bill_date::date AS bill_date, vendor_name, total, status
      FROM bills
      -- 'live_sale' bills are /api/sales/live-tap's own "Internal
      -- Consumption" stock-adjustment records (see that route) -- they
      -- exist purely to keep the target item's live stock number in sync
      -- when a GMC-linked service is tapped, not to be seen as a real
      -- vendor bill. Item 360's own history already shows that
      -- consumption from the sales side; this list is for real bills only.
      WHERE source IS DISTINCT FROM 'live_sale'
      ORDER BY bill_date DESC, id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `
    if (rows.length === limit) {
      console.warn(`bills: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    const withOptional = rows.map((r: any) => ({
      ...r,
      entered_by: r.entered_by || null,
      attachments: r.attachments || []
    }))
    return success(withOptional)
  } catch (e) {
    console.error('bills/route.ts GET error:', e instanceof Error ? e.message : String(e))
    try {
      const rows = await sql`
        SELECT id, bill_number, bill_date::date AS bill_date, vendor_name, total, status
        FROM bills
        WHERE source IS DISTINCT FROM 'live_sale'
        ORDER BY bill_date DESC, id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
      console.log('bills/route.ts fallback returned', rows.length, 'rows')
      const withOptional = rows.map((r: any) => ({
        ...r,
        entered_by: null,
        attachments: []
      }))
      return success(withOptional)
    } catch (e2) {
      console.error('bills/route.ts fallback error:', e2 instanceof Error ? e2.message : String(e2))
      return success([])
    }
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { date, lines } = (await req.json()) as {
    date: string
    lines: { itemId: number; itemName: string; qty: number; price: number; total: number; vendorName: string | null }[]
  }
  if (!date || !lines?.length) return badRequest('Missing fields')

  // A line with no real quantity isn't a transaction -- it's a phantom row
  // that pollutes per-date aliases and other displays while contributing
  // nothing to any actual stock math. Reject it outright.
  for (const l of lines) {
    const qty = Number(l.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return badRequest(`"${l.itemName || 'a line'}" needs a valid quantity greater than 0.`)
    }
  }

  // A "GMC only, no service" item is never bought directly -- its only
  // stock-in path is a pack_to_gmc item's conversion credit. A bill
  // against one is always a mis-click (the wrong item was picked), not a
  // real restock, so it's blocked here rather than silently accepted.
  const itemIds = lines.map(l => l.itemId).filter((id): id is number => !!id)
  if (itemIds.length > 0) {
    const gmcOnlyItems = await sql`
      SELECT id, canonical_name FROM items WHERE id = ANY(${itemIds}) AND gmc_type = 'gmc'
    ` as unknown as { id: number; canonical_name: string }[]
    if (gmcOnlyItems.length > 0) {
      const names = gmcOnlyItems.map(i => `"${i.canonical_name}"`).join(', ')
      return badRequest(`${names} ${gmcOnlyItems.length === 1 ? 'is a' : 'are'} "GMC only, no service" item${gmcOnlyItems.length === 1 ? '' : 's'} -- these are never bought directly, only credited from a pack's GMC conversion. Check the item picked.`)
    }
  }

  const enteredBy = session!.user?.name || (session!.user as any)?.username || null
  const grandTotal = lines.reduce((s: number, l) => s + Number(l.total), 0)

  // Each item line becomes its own bills row (one bill_lines child each),
  // matching the historical import pattern -- so a line's vendor is its own
  // column, not a single vendor shared across a whole multi-item bill.
  try {
    const billNumbers: string[] = []
    const billRecords: { id: number; billNumber: string; lineIndex: number }[] = []

    // Insert all bills in parallel (via connection pool), collect IDs and line indices
    const results = await Promise.all(
      lines.map(async (l, i) => {
        const billNumber = `APP-BILL-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}-${i}`
        const vendorName = l.vendorName || null

        let bill
        try {
          [bill] = await sql`
            INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source, entered_by, zoho_bill_id)
            VALUES (${billNumber}, ${date}, ${vendorName}, ${l.total}, ${l.total}, 'paid', 'app', ${enteredBy}, ${billNumber})
            RETURNING id
          `
        } catch (e) {
          console.error('bills insert with entered_by failed, retrying without it:', e)
          ;[bill] = await sql`
            INSERT INTO bills (bill_number, bill_date, vendor_name, total, subtotal, status, source, zoho_bill_id)
            VALUES (${billNumber}, ${date}, ${vendorName}, ${l.total}, ${l.total}, 'paid', 'app', ${billNumber})
            RETURNING id
          `
        }
        return { id: bill.id, billNumber, lineIndex: i }
      })
    )

    results.forEach(r => {
      billNumbers.push(r.billNumber)
      billRecords.push(r)
    })

    // Batch insert all bill lines in parallel (one per bill, which is efficient)
    await Promise.all(
      billRecords.map(br => {
        const l = lines[br.lineIndex]
        return sql`
          INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, quantity, unit_price, item_total, unresolved, source)
          VALUES (${br.id}, ${l.itemId}, ${l.itemName}, ${l.itemName}, ${l.qty}, ${l.price}, ${l.total}, false, 'app')
        `
      })
    )

    try {
      const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${date}`
      if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date})`
    } catch (e) {
      console.error('cash_at_bank ensure-row error (non-fatal):', e)
    }

    const vendorsUsed = Array.from(new Set(lines.map(l => l.vendorName).filter(Boolean)))
    const vendorNote = vendorsUsed.length === 1 ? ` from ${vendorsUsed[0]}` : vendorsUsed.length > 1 ? ` from ${vendorsUsed.length} vendors` : ''
    await logActivity(enteredBy ?? 'Unknown', 'added bill', `${lines.length} line${lines.length > 1 ? 's' : ''} · ₵${grandTotal.toFixed(2)}${vendorNote}`)
    return success({ ok: true, billNumbers })
  } catch (e) {
    return handleError('bills POST', e)
  }
}
