import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { SIGNERS } from '@/lib/signers'
import { videoForLaw } from '@/lib/videoDue'
import { notifyManagement } from '@/lib/checklistAlerts'

// ONE QUESTION A DAY. Each staff member gets one multiple-choice question a day, taken from the laws' own quizzes. A law they broke in the last two weeks is asked first, so the
// question is about what they actually got wrong. A wrong answer shows the right one and the law. No points: it is how the laws are learnt, not signed.
type Q = { q: string; options: string[]; answer: number; why?: string }
const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_daily_questions (day TEXT NOT NULL, staff TEXT NOT NULL, law_id INTEGER NOT NULL, qi INTEGER NOT NULL, correct BOOLEAN, answered_at TIMESTAMPTZ, PRIMARY KEY (day, staff))`.catch(() => {})
})
const today = () => new Date().toISOString().slice(0, 10)
const parse = (raw: unknown): Q[] => { try { const a = JSON.parse(String(raw ?? '[]')); return Array.isArray(a) ? a.filter((x: Q) => x && x.q && Array.isArray(x.options) && Number.isInteger(x.answer)) : [] } catch { return [] } }
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) }

async function pick(me: string, day: string): Promise<{ lawId: number; qi: number } | null> {
  const laws = await sql`SELECT id, quiz FROM page_laws WHERE status = 'live' AND quiz IS NOT NULL AND quiz <> '' AND quiz <> '[]' ORDER BY id` as unknown as { id: number; quiz: string }[]
  const withQ = laws.map(l => ({ id: Number(l.id), qs: parse(l.quiz) })).filter(l => l.qs.length)
  if (!withQ.length) return null
  const broke = (await sql`SELECT DISTINCT law_id FROM staff_penalties WHERE staff = ${me} AND law_id IS NOT NULL AND day >= ${new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)}`).map(r => Number(r.law_id))
  const pool = withQ.filter(l => broke.includes(l.id)).length ? withQ.filter(l => broke.includes(l.id)) : withQ
  const l = pool[hash(me + day) % pool.length]
  return { lawId: l.id, qi: hash(day + me + 'q') % l.qs.length }
}

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensure()
    const me = actorKey(session.user as never), day = today()
    if (!SIGNERS.includes(me) || me === 'grony') return success({ question: null })
    let [row] = await sql`SELECT law_id, qi, correct FROM law_daily_questions WHERE day = ${day} AND staff = ${me}`
    if (row && row.correct != null) return success({ question: null })
    if (!row) {
      const p = await pick(me, day); if (!p) return success({ question: null })
      await sql`INSERT INTO law_daily_questions (day, staff, law_id, qi) VALUES (${day}, ${me}, ${p.lawId}, ${p.qi}) ON CONFLICT DO NOTHING`
      row = { law_id: p.lawId, qi: p.qi, correct: null }
    }
    const [l] = await sql`SELECT id, title, quiz FROM page_laws WHERE id = ${row.law_id}`
    const q = parse(l?.quiz)[Number(row.qi)]
    if (!q) return success({ question: null })
    return success({ question: { lawId: Number(l.id), law: l.title, q: q.q, options: q.options } })
  } catch (e) { return handleError('law question GET', e) }
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensure()
    const me = actorKey(session.user as never), day = today()
    const b = await req.json().catch(() => ({}))
    const [row] = await sql`SELECT law_id, qi, correct FROM law_daily_questions WHERE day = ${day} AND staff = ${me}`
    if (!row) return badRequest('No question for you today.')
    const [l] = await sql`SELECT title, text, quiz, category, subcategory FROM page_laws WHERE id = ${row.law_id}`
    const q = parse(l?.quiz)[Number(row.qi)]
    if (!q) return badRequest('That question is no longer there.')
    const correct = Number(b.answer) === q.answer
    if (row.correct == null) {
      await sql`UPDATE law_daily_questions SET correct = ${correct}, answered_at = now() WHERE day = ${day} AND staff = ${me}`
      void notifyManagement(me, `${me.charAt(0).toUpperCase() + me.slice(1)}: question of the day ${correct ? 'right' : 'wrong'}`, `${q.q.slice(0, 120)} · answered: ${String(q.options[Number(b.answer)] ?? '-').slice(0, 80)}${correct ? '' : ` · right answer: ${q.options[q.answer].slice(0, 80)}`}`)
    }
    return success({ correct, right: q.options[q.answer], why: q.why ?? null, law: l?.title ?? null, text: l?.text ?? null, video: correct || !l ? null : videoForLaw({ category: l.category ?? null, subcategory: l.subcategory ?? null }) })
  } catch (e) { return handleError('law question POST', e) }
}
