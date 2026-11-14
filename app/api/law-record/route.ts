import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { isManagerName } from '@/lib/signers'
import { viewablePeople } from '@/lib/myDay'
import { NextRequest } from 'next/server'
import { LAW_AREAS } from '@/lib/lawAreas'
import { videosDue } from '@/lib/videoDue'

// GET ?staff=name -- one person's record with the laws: which laws they have signed (and when), and their quiz results.
// A person sees their own; a supervisor sees the people they may look at (the same rule as Waiting for me).
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    const me = actorKey(user as never)
    const who = (req.nextUrl.searchParams.get('staff') ?? me).toLowerCase()
    if (who !== me && !viewablePeople(user as never).includes(who)) return badRequest('You cannot look at that record.')
    await ensureCompanyLaws()
    const manager = isManagerName(who)
    const laws = await sql`SELECT id, code, title, text, category, audience, live_at, COALESCE(jsonb_array_length(NULLIF(quiz, '')::jsonb), 0) AS quiz_n,
        md5(coalesce(text,'') || '|' || coalesce(dos,'') || '|' || coalesce(donts,'')) AS h
      FROM page_laws WHERE status = 'live' AND (audience <> 'managers' OR ${manager}) ORDER BY category, id` as unknown as { id: number; code: string | null; title: string | null; text: string; category: string | null; quiz_n: number; h: string }[]
    const sigs = await sql`SELECT law_id, law_hash, signed_at FROM law_signatures WHERE staff = ${who}`.catch(() => []) as unknown as { law_id: number; law_hash: string; signed_at: string }[]
    const marks = await sql`SELECT law_id, score, total, law_hash, taken_at FROM law_quiz_marks WHERE staff = ${who}`.catch(() => []) as unknown as { law_id: number; score: number; total: number; law_hash: string; taken_at: string }[]
    const cats = await sql`SELECT category, MAX(score) AS score, MAX(total) AS total, BOOL_OR(passed) AS passed, MAX(taken_at) AS last FROM law_quiz_results WHERE staff = ${who} GROUP BY category ORDER BY category`.catch(() => [])
    const sig = new Map(sigs.map(s => [Number(s.law_id), s])), mk = new Map(marks.map(m => [Number(m.law_id), m]))
    const out = laws.map(l => {
      const s = sig.get(Number(l.id)), m = mk.get(Number(l.id))
      return {
        id: l.id, code: l.code, title: l.title || String(l.text).slice(0, 80), category: l.category, quiz_n: Number(l.quiz_n),
        signed_at: s && s.law_hash === l.h ? s.signed_at : null,
        changed_since: !!s && s.law_hash !== l.h,
        quiz: m && m.law_hash === l.h ? { score: Number(m.score), total: Number(m.total), taken_at: m.taken_at } : null,
      }
    })
    // The tile videos (staff tiles with a video): watched to the end or not, and when each is due.
    const seen = await sql`SELECT area, MIN(watched_at) AS at FROM law_video_views WHERE staff = ${who} GROUP BY area`.catch(() => []) as unknown as { area: string; at: string }[]
    const due = new Map((await videosDue(who).catch(() => [])).map(v => [v.key, v]))
    const videos = LAW_AREAS.filter(a => a.video && !a.ownerOnly).map(a => { const w = seen.find(s => s.area === a.key), dv = due.get(a.key)
      return { key: a.key, label: a.label, watched_at: w?.at ?? null, due: dv?.dueDate ?? null, overdue: !!dv?.overdue } })
    // The question of the day: the last 30 days.
    const questions = await sql`SELECT q.day, q.correct, l.title FROM law_daily_questions q LEFT JOIN page_laws l ON l.id = q.law_id WHERE q.staff = ${who} AND q.day >= ${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)} ORDER BY q.day DESC`.catch(() => []) as unknown as { day: string; correct: boolean | null; title: string | null }[]
    return success({ staff: who, laws: out, categoryQuizzes: cats, videos, questions })
  } catch (e) { return handleError('law-record GET', e) }
}
