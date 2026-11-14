import sql from '@/lib/db'
import { EVER_STAFF, ACTIVE_STAFF } from '@/lib/staffList'
import { CHECKLIST_START } from '@/lib/dailyChecksShared'

// The system check: places where one part of the app does not agree with another. Each check says how many, shows a few examples, and links to where it is fixed.
export type Check = { key: string; title: string; count: number; status: 'ok' | 'warn' | 'bad'; examples: string[]; href?: string; hint: string }
const safe = async <T,>(f: () => Promise<T>, d: T): Promise<T> => { try { return await f() } catch { return d } }
const lvl = (n: number, bad = 1): 'ok' | 'warn' | 'bad' => n === 0 ? 'ok' : n >= bad * 5 ? 'bad' : 'warn'

export async function runChecks(flags?: Record<string, unknown>): Promise<Check[]> {
  const out: Check[] = []
  const add = (c: Omit<Check, 'status'> & { status?: Check['status'] }) => out.push({ status: lvl(c.count), ...c })

  // People
  const users = await safe(() => sql`SELECT username FROM app_users WHERE active IS NOT FALSE`, [] as { username: string }[])
  const notInList = users.map(u => String(u.username).toLowerCase()).filter(u => !EVER_STAFF.includes(u))
  add({ key: 'users-not-staff', title: 'Active logins that are not in the staff list', count: notInList.length, examples: notInList.slice(0, 5), href: '/item?view=users', hint: 'Add them to lib/staffList.ts, or deactivate the account if they are not staff (a caretaker or other special role can be ignored).' })
  const noPush = await safe(() => sql`SELECT u FROM unnest(${ACTIVE_STAFF}::text[]) AS u WHERE NOT EXISTS (SELECT 1 FROM push_subscriptions p WHERE LOWER(p.username) = u)`, [] as { u: string }[])
  add({ key: 'no-push', title: 'Staff who cannot receive notifications (no device registered)', count: noPush.length, examples: noPush.map(r => String(r.u)), href: '/notifications', hint: 'They must open the app on their phone and allow notifications, or no reminder or prompt will reach them.' })

  // Laws
  const lawNo = await safe(() => sql`SELECT id, COALESCE(code, 'law ' || id) AS c FROM page_laws WHERE status = 'live' AND (title IS NULL OR title = '' OR violations IS NULL OR violations = '' OR violations = '[]')`, [] as { c: string }[])
  add({ key: 'laws-incomplete', title: 'Live laws without a title or a violation line', count: lawNo.length, examples: lawNo.slice(0, 5).map(r => String(r.c)), href: '/laws', hint: 'Open the law and add them.' })
  const noQuiz = await safe(() => sql`SELECT COALESCE(code, 'law ' || id) AS c FROM page_laws WHERE status = 'live' AND audience = 'staff' AND (quiz IS NULL OR quiz = '' OR quiz = '[]')`, [] as { c: string }[])
  // Law quizzes are no longer a duty (14 Nov 2026), so laws without one are not a problem.
  if (false as boolean) add({ key: 'laws-no-quiz', title: 'Live laws without a quiz', count: noQuiz.length, examples: noQuiz.slice(0, 5).map(r => String(r.c)), href: '/laws', hint: 'Staff cannot be marked on them.', status: noQuiz.length ? 'warn' : 'ok' })
  const drafts = await safe(() => sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE status = 'draft'`, [{ n: 0 }])
  add({ key: 'drafts', title: 'Draft laws waiting for approval', count: Number(drafts[0].n), examples: [], href: '/laws', hint: 'Approving creates their checklist tiles.', status: Number(drafts[0].n) ? 'warn' : 'ok' })
  const noTile = await safe(() => sql`SELECT COALESCE(code, 'law ' || id) AS c FROM page_laws WHERE status = 'live' AND law_type = 'recurring' AND tile_id IS NULL AND frequency IS NOT NULL`, [] as { c: string }[])
  add({ key: 'recurring-no-tile', title: 'Recurring laws with no task in Waiting for team', count: noTile.length, examples: noTile.slice(0, 5).map(r => String(r.c)), href: '/todo', hint: 'The task is a law but staff never see it on the checklist, so nothing can be missed or penalised.' })
  const orphanTile = await safe(() => sql`SELECT title FROM daily_check_tiles WHERE active AND law_id IS NULL AND frequency = 'daily'`, [] as { title: string }[])
  add({ key: 'tile-no-law', title: 'Active task tiles that no law backs', count: orphanTile.length, examples: orphanTile.slice(0, 5).map(r => String(r.title)), href: '/todo', hint: 'An old tile: either write the law for it or switch it off, so the checklist and the laws agree.', status: orphanTile.length ? 'warn' : 'ok' })

  // Waiting too long
  const oldClaims = await safe(() => sql`SELECT staff FROM clock_corrections WHERE status = 'pending' AND requested_at < now() - interval '48 hours'`, [] as { staff: string }[])
  const oldSanc = await safe(() => sql`SELECT staff FROM penalty_sanctions WHERE status = 'proposed' AND created_at < now() - interval '48 hours'`, [] as { staff: string }[])
  const oldViol = await safe(() => sql`SELECT staff FROM staff_penalties WHERE status IN ('pending', 'disputed') AND created_at < now() - interval '48 hours'`, [] as { staff: string }[])
  const oldCctv = await safe(() => sql`SELECT work_date::text AS d FROM cctv_reviews WHERE status = 'pending' AND created_at < now() - interval '48 hours'`, [] as { d: string }[])
  add({ key: 'old-approvals', title: 'Approvals and reviews waiting more than 48 hours', count: oldClaims.length + oldSanc.length + oldViol.length + oldCctv.length, examples: [...oldClaims.map(r => 'clock time: ' + r.staff), ...oldSanc.map(r => 'sanction: ' + r.staff), ...oldViol.map(r => 'violation: ' + r.staff), ...oldCctv.map(r => 'CCTV: ' + r.d)].slice(0, 5), href: '/item?me=waiting', hint: 'They already cost Joe a point each (the 48-hour laws).' })

  // Time and attendance
  const open = await safe(() => sql`SELECT LOWER(staff_name) AS n, work_date::text AS d FROM staff_times WHERE actual_in IS NOT NULL AND actual_out IS NULL AND staff_name <> '__shop_open__' AND work_date >= ${CHECKLIST_START} AND work_date < CURRENT_DATE`, [] as { n: string; d: string }[])
  add({ key: 'open-clocks', title: 'Past days still clocked in (no time out)', count: open.length, examples: open.slice(0, 5).map(r => `${r.n} ${r.d}`), href: '/item?me=waiting', hint: 'The app clocks people out from their last shop activity each morning; days with no shop activity wait for the person to enter their time.' })
  const nonStaffTimes = await safe(() => sql`SELECT DISTINCT LOWER(staff_name) AS n FROM staff_times WHERE staff_name <> '__shop_open__' AND work_date >= ${CHECKLIST_START}`, [] as { n: string }[])
  const strange = nonStaffTimes.map(r => String(r.n)).filter(n => !EVER_STAFF.includes(n))
  add({ key: 'times-unknown', title: 'Time records for names not in the staff list', count: strange.length, examples: strange.slice(0, 5), href: '/item?view=teamTimes', hint: 'A spelling difference or a new person.' })

  // Items
  const noBarcode = await safe(() => sql`SELECT COUNT(*)::int AS n FROM active_items i WHERE COALESCE(i.sellable, true) AND NOT EXISTS (SELECT 1 FROM item_barcodes b WHERE b.item_id = i.id)`, [{ n: 0 }])
  add({ key: 'no-barcode', title: 'Sellable items without a barcode', count: Number(noBarcode[0].n), examples: [], href: '/barcode-labels', hint: 'Scan once to link a printed barcode, or print your own labels.', status: Number(noBarcode[0].n) ? 'warn' : 'ok' })
  const noPrice = await safe(() => sql`SELECT canonical_name AS n FROM active_items WHERE COALESCE(sellable, true) AND (selling_rate IS NULL OR selling_rate <= 0) LIMIT 50`, [] as { n: string }[])
  add({ key: 'no-price', title: 'Sellable items with no selling price', count: noPrice.length, examples: noPrice.slice(0, 5).map(r => String(r.n)), href: '/item?view=items', hint: 'A sale tap at ₵0 is refused, so staff cannot sell them.' })
  // Flags: what the app itself reports as wrong, and how long it has been there.
  if (flags) {
    const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const open: string[] = [], stale: string[] = []
    let openN = 0, staleN = 0
    for (const [k, v] of Object.entries(flags)) {
      if (!Array.isArray(v) || !v.length) continue
      openN += v.length; open.push(`${k} (${v.length})`)
      const dates: string[] = []
      for (const row of v) if (row && typeof row === 'object') for (const [f, val] of Object.entries(row as Record<string, unknown>)) if (/date|day/i.test(f) && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) dates.push(val.slice(0, 10))
      const old = dates.filter(d => d < week).length
      if (old) { staleN += old; stale.push(`${k} (${old})`) }
    }
    add({ key: 'flags-open', title: 'Open flags (the app reports something wrong)', count: openN, examples: open.slice(0, 6), href: '/item?view=flags', hint: 'Flags are fixed by managers only. Each one names its page; the Flags page groups them.', status: openN === 0 ? 'ok' : openN > 25 ? 'bad' : 'warn' })
    add({ key: 'flags-stale', title: 'Flags that have been open more than a week', count: staleN, examples: stale.slice(0, 6), href: '/item?view=flags', hint: 'An old flag is either a real fault nobody fixed, or a flag that no longer matters and should be cleared.' })
  }

  // Sales: items sold in a way that does not agree with the rules.
  const atLoss = await safe(() => sql`SELECT i.canonical_name AS n FROM live_sale_taps t JOIN items i ON i.id = t.item_id
    WHERE NOT t.undone AND t.tapped_at > now() - interval '30 days' AND COALESCE(i.adjusted_cost_price, i.purchase_rate, 0) > 0 AND t.price <= COALESCE(i.adjusted_cost_price, i.purchase_rate, 0)`, [] as { n: string }[])
  add({ key: 'sold-at-loss', title: 'Items sold at or below cost (last 30 days)', count: atLoss.length, examples: Array.from(new Set(atLoss.map(r => String(r.n)))).slice(0, 5), href: '/item?view=sales', hint: 'The sale screen refuses these, so they were recorded before the cost changed, or by another route. Check the price or the cost.' })
  const noWho = await safe(() => sql`SELECT t.id FROM live_sale_taps t WHERE NOT t.undone AND t.tapped_at > now() - interval '7 days' AND t.customer_id_code IS NULL
    AND NOT EXISTS (SELECT 1 FROM sale_buyers b WHERE b.tap_id = t.id)`, [] as { id: number }[])
  add({ key: 'sold-no-who', title: 'Sales with no customer or label (last 7 days)', count: noWho.length, examples: [], href: '/item?view=sales', hint: 'Every sale must say who it is for (a customer, or a label such as "man in red").' })
  const negStock = await safe(() => sql`SELECT i.canonical_name AS n FROM active_items i JOIN item_stock_summary s ON s.item_id = i.id WHERE s.calculated_soh < 0 LIMIT 100`, [] as { n: string }[])
  add({ key: 'negative-stock', title: 'Items with negative stock', count: negStock.length, examples: negStock.slice(0, 5).map(r => String(r.n)), href: '/item?view=flags', hint: 'Stock cannot be below zero. A sale was recorded before the stock was, or a count is missing: count the shelf.' })
  return out
}
