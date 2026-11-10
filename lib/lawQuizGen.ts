import sql from '@/lib/db'
import type { LawQuestion } from '@/lib/lawQuiz'

// Laws that have no quiz yet get a short two-question quiz made from the law itself, so every law can be learned and marked:
//   1. "Which of these is the rule in this law?" -- the law's own title against titles of OTHER laws in the same category;
//   2. "What happens if it is not followed?" -- the consequence that matches the kind of law (task, standing rule, app-checked).
// The owner can replace or extend any quiz in Company Laws. A law that already has a quiz is never touched.
const CONSEQUENCE: Record<string, { right: string; wrong: string[] }> = {
  recurring: { right: 'The task is left undone on the Daily Checklist and a point is lost at the end of the day', wrong: ['Nothing happens: it is only advice', 'Only a spoken warning, with no record', 'The staff member pays for it'] },
  standing: { right: 'A manager logs a violation with a note: 1 point', wrong: ['Nothing happens: it is only advice', 'Only a spoken warning, with no record', 'The customer decides the penalty'] },
  app: { right: 'The app finds it itself and adds the point', wrong: ['Nothing happens: it is only advice', 'Only a spoken warning, with no record', 'Staff are asked to mark themselves'] },
}
const place = (id: number, right: string, wrong: string[]) => { const pos = id % 4; const opts = wrong.slice(0, 3); opts.splice(pos, 0, right); return { options: opts, answer: pos } }

export function quizFor(law: { id: number; title: string; text: string; law_type: string | null }, siblings: string[]): LawQuestion[] {
  const others = siblings.filter(t => t && t !== law.title).slice(0, 12)
  const wrong = [0, 1, 2].map(k => others[(law.id * 3 + k * 5) % Math.max(others.length, 1)]).filter((t, i, a) => t && a.indexOf(t) === i)
  const out: LawQuestion[] = []
  const why = law.text.replace(/\s+/g, ' ').slice(0, 280)
  if (wrong.length >= 3) { const p = place(law.id, law.title, wrong); out.push({ q: 'Which of these is the rule in THIS law (the one you are reading and signing)?', options: p.options, answer: p.answer, why }) }
  const c = CONSEQUENCE[law.law_type ?? 'standing'] ?? CONSEQUENCE.standing
  const p2 = place(law.id + 1, c.right, c.wrong)
  out.push({ q: `If you do not follow this law (${law.title.slice(0, 70)}), what happens?`, options: p2.options, answer: p2.answer, why: 'Every law has a violation line. ' + why })
  return out
}

export async function fillQuizzesOnce() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('fill-law-quizzes-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, category, title, text, law_type, quiz FROM page_laws WHERE status = 'live' AND title IS NOT NULL AND title <> ''` as unknown as { id: number; category: string | null; title: string; text: string; law_type: string | null; quiz: string | null }[]
    const byCat: Record<string, string[]> = {}
    for (const r of rows) (byCat[r.category ?? ''] ??= []).push(r.title)
    for (const r of rows) {
      if (r.quiz && r.quiz !== '[]' && r.quiz.trim() !== '') continue
      const qs = quizFor(r, byCat[r.category ?? ''] ?? [])
      if (qs.length) await sql`UPDATE page_laws SET quiz = ${JSON.stringify(qs)} WHERE id = ${r.id}`
    }
  } catch (e) { console.error('fill law quizzes failed:', e instanceof Error ? e.message : String(e)) }
}
