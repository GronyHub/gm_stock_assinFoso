import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { SIGNERS, isManagerName } from '@/lib/signers'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { parseViolations } from '@/lib/lawViolations'
import { NextRequest } from 'next/server'

const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_reminder_confirms (day TEXT NOT NULL, staff TEXT NOT NULL, law_id INTEGER NOT NULL, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, staff, law_id))`.catch(() => {})
})
const today = () => new Date().toISOString().slice(0, 10)

// GET -- the reminder to show me now: { stage, laws } or { stage: null }. The login list comes first; after my first sale today, the list of selling
// laws. GET ?summary=1 -- who has confirmed what today (for the Daily Checklist strip).
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureCompanyLaws(); await ensure()
    const me = actorKey(user as any), day = today()
    if (req.nextUrl.searchParams.get('summary')) {
      const laws = await sql`SELECT id, reminder, audience FROM page_laws WHERE status = 'live' AND law_type = 'standing' AND reminder <> 'none'`
      const conf = await sql`SELECT staff, law_id FROM law_reminder_confirms WHERE day = ${day}`
      const out = SIGNERS.map(n => {
        const mine = laws.filter(l => isManagerName(n) || l.audience !== 'managers')
        const done = new Set(conf.filter(c => String(c.staff) === n).map(c => Number(c.law_id)))
        const stage = (st: string) => { const ls = mine.filter(l => l.reminder === st); return { total: ls.length, done: ls.filter(l => done.has(Number(l.id))).length } }
        return { staff: n, login: stage('login'), first_sale: stage('first_sale') }
      })
      return success({ day, people: out })
    }
    if (!SIGNERS.includes(me)) return success({ stage: null })
    const mgr = isManagerName(me)
    const laws = await sql`SELECT id, code, title, reminder, violations FROM page_laws WHERE status = 'live' AND law_type = 'standing' AND reminder <> 'none' AND (audience <> 'managers' OR ${mgr}) ORDER BY id`
    const done = new Set((await sql`SELECT law_id FROM law_reminder_confirms WHERE day = ${day} AND staff = ${me}`).map(r => Number(r.law_id)))
    const pick = (st: string) => laws.filter(l => l.reminder === st && !done.has(Number(l.id))).map(l => ({ id: Number(l.id), code: l.code, title: l.title, violation: parseViolations(l.violations)[0]?.text ?? '' }))
    const login = pick('login')
    if (login.length) return success({ stage: 'login', laws: login })
    const sold = (await sql`SELECT 1 FROM live_sale_taps WHERE LOWER(staff_name) = ${me} AND tapped_at::date = ${day}::date AND undone IS NOT TRUE LIMIT 1`).length > 0
    const sales = sold ? pick('first_sale') : []
    return success(sales.length ? { stage: 'first_sale', laws: sales } : { stage: null })
  } catch (e) { return handleError('law-reminders GET', e) }
}

// POST { ids } -- I confirm I have read these reminders and agree to follow them.
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensure()
    const me = actorKey(user as any)
    if (!SIGNERS.includes(me)) return badRequest('Not on the signing list.')
    const b = await req.json().catch(() => ({}))
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isInteger)
    if (!ids.length) return badRequest('Nothing to confirm.')
    for (const id of ids) await sql`INSERT INTO law_reminder_confirms (day, staff, law_id) VALUES (${today()}, ${me}, ${id}) ON CONFLICT DO NOTHING`
    return success({ confirmed: ids.length })
  } catch (e) { return handleError('law-reminders POST', e) }
}
