import { cap } from '@/lib/strings'
import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { recordActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { ensureAttendance, to12h } from '@/lib/attendance'
import { pushToUsers, notifyOwners } from '@/lib/checklistAlerts'
import { SIGNERS } from '@/lib/signers'
import { actorKey } from '@/lib/clockState'
import { NextRequest } from 'next/server'

const canReview = (u: unknown) => isOwnerLevel(u as never)

// GET -- days when staff worked and Joe had not clocked in: the windows, who was there, the sales tapped in those windows, and the review status.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!canReview(session.user)) return success({ reviews: [], pending: 0 })
  try {
    await ensureAttendance()
    const summary = req.nextUrl.searchParams.get('summary')
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM cctv_reviews WHERE status = 'pending' AND work_date < ${new Date().toISOString().slice(0, 10)}`
    const [oldest] = await sql`SELECT work_date FROM cctv_reviews WHERE status = 'pending' AND work_date < ${new Date().toISOString().slice(0, 10)} ORDER BY work_date LIMIT 1`
    // Grony is in the UK and cannot watch the shop CCTV: only Joe is forced to review; Grony can read the results and prompt Joe.
    if (summary) return success(actorKey(session.user as any) === 'joe' ? { pending: Number(n), oldest: oldest?.work_date ?? null } : { pending: 0, oldest: null, all: Number(n) })
    const rows = await sql`SELECT work_date::text AS day, windows, staff, status, reviewed_by, reviewed_at, sales_ok, laws_ok, note FROM cctv_reviews ORDER BY (status = 'pending') DESC, work_date DESC LIMIT 30`
    const reviews = []
    for (const r of rows) {
      const windows = JSON.parse(String(r.windows)) as { from: number; to: number }[]
      const taps = await sql`SELECT item_name, price, quantity, staff_name, tapped_at, undone FROM live_sale_taps WHERE tapped_at::date = ${r.day}::date ORDER BY tapped_at`
      const inWin = taps.filter(t => { const d = new Date(t.tapped_at as string); const m = d.getUTCHours() * 60 + d.getUTCMinutes(); return windows.some(w => m >= w.from && m < w.to) })
      reviews.push({
        day: r.day, status: r.status, staff: JSON.parse(String(r.staff)), reviewed_by: r.reviewed_by, sales_ok: r.sales_ok, laws_ok: r.laws_ok, note: r.note,
        windows: windows.map(w => ({ from: to12h(w.from), to: to12h(w.to) })),
        sales: inWin.map(t => { const d = new Date(t.tapped_at as string); return { time: to12h(d.getUTCHours() * 60 + d.getUTCMinutes()), item: t.item_name, qty: t.quantity, price: Number(t.price), staff: t.staff_name, undone: !!t.undone } }),
      })
    }
    return success({ reviews, pending: Number(n), oldest: oldest?.work_date ?? null })
  } catch (e) { return handleError('cctv-review GET', e) }
}

// POST { action: 'complete', day, sales_ok, laws_ok, note } | { action: 'query', day, staff, about }
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (actorKey(session.user as any) !== 'joe') return badRequest('Joe reviews the CCTV (he has the CCTV app). Grony can prompt him from the Daily Checklist.')
  try {
    await ensureAttendance()
    const b = await req.json().catch(() => ({}))
    const day = String(b.day ?? ''), by = getActorName(session)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return badRequest('Choose a day.')
    if (b.action === 'query') {
      const staff = String(b.staff ?? '').toLowerCase(), about = String(b.about ?? '').trim().slice(0, 400)
      if (!SIGNERS.includes(staff) || about.length < 4) return badRequest('Choose who to ask and write the question.')
      await sql`INSERT INTO staff_queries (staff, from_user, about, work_date, review_day) VALUES (${staff}, ${by}, ${about}, ${day}, ${day})`
      void pushToUsers([staff], 'A question about ' + day, `${cap(by)} asks: ${about}`)
      return success({ ok: true })
    }
    if (b.action === 'complete') {
      const salesOk = !!b.sales_ok, lawsOk = !!b.laws_ok, note = String(b.note ?? '').trim().slice(0, 500)
      if ((!salesOk || !lawsOk) && note.length < 4) return badRequest('Say what was wrong, then log a violation or send a question for it.')
      await sql`UPDATE cctv_reviews SET status = 'done', reviewed_by = ${by}, reviewed_at = now(), sales_ok = ${salesOk}, laws_ok = ${lawsOk}, note = ${note} WHERE work_date = ${day}`
      void recordActivity(by, 'completed a CCTV review', `${day}: sales ${salesOk ? 'as expected' : 'NOT as expected'}, laws ${lawsOk ? 'observed' : 'NOT observed'}`)
      void notifyOwners(`CCTV review done for ${day}`, `${cap(by)}: sales ${salesOk ? 'all as expected' : 'NOT all as expected'}, laws ${lawsOk ? 'all observed' : 'NOT all observed'}.`)
      return success({ ok: true })
    }
    return badRequest('Unknown action.')
  } catch (e) { return handleError('cctv-review POST', e) }
}
