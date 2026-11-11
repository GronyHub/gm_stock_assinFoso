'use client'
import { useEffect, useState } from 'react'

type L = { id: number; code: string | null; title: string; category: string | null; quiz_n: number; signed_at: string | null; changed_since: boolean; quiz: { score: number; total: number; taken_at: string } | null }
type Data = { staff: string; laws: L[]; categoryQuizzes: { category: string; score: number; total: number; passed: boolean; last: string }[] }
const dlabel = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const passed = (q: { score: number; total: number } | null) => !!q && q.total > 0 && q.score / q.total >= 0.75

// One person's record with the laws: the laws they have signed and their quiz results. (The team's own view of this is the signature table in the Company Laws.)
export default function PersonLaws({ staff }: { staff: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  useEffect(() => {
    setD(null); setErr('')
    fetch(`/api/law-record?staff=${encodeURIComponent(staff)}`, { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Could not load'); setD(j) }).catch(e => setErr(e.message))
  }, [staff])
  if (err) return <p className="p-3 text-sm text-red-600">{err}</p>
  if (!d) return <p className="p-3 text-sm text-gray-400">Loading…</p>
  const signed = d.laws.filter(l => l.signed_at).length
  const withQuiz = d.laws.filter(l => l.quiz_n > 0)
  const quizPassed = withQuiz.filter(l => passed(l.quiz)).length
  const byCat = new Map<string, L[]>()
  for (const l of d.laws) { const k = l.category ?? 'Other'; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(l) }
  return (
    <div className="space-y-3 p-2">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className={`rounded-xl p-2 ${signed === d.laws.length ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}><p className="text-xl font-extrabold">{signed}/{d.laws.length}</p><p className="text-[11px] font-semibold">laws signed</p></div>
        <div className={`rounded-xl p-2 ${quizPassed === withQuiz.length ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}><p className="text-xl font-extrabold">{quizPassed}/{withQuiz.length}</p><p className="text-[11px] font-semibold">law quizzes passed (75% or more)</p></div>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> Show only what is still open</label>

      {d.categoryQuizzes.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">Category quizzes</p>
          <div className="space-y-1">{d.categoryQuizzes.filter(c => !onlyOpen || !c.passed).map(c => (
            <div key={c.category} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${c.passed ? 'bg-green-50' : 'bg-red-50'}`}><span className="font-semibold text-gray-900">{c.category}</span><span className="font-bold">{c.score}/{c.total} · {c.passed ? 'passed' : 'not passed'} · {dlabel(c.last)}</span></div>))}</div>
        </div>
      )}

      {Array.from(byCat.entries()).map(([cat, list]) => {
        const rows = list.filter(l => !onlyOpen || !l.signed_at || (l.quiz_n > 0 && !passed(l.quiz)))
        if (!rows.length) return null
        return (
          <div key={cat}>
            <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{cat}</p>
            <div className="space-y-1">{rows.map(l => (
              <div key={l.id} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs">
                <p className="font-semibold text-gray-900">{l.code ? <b>{l.code} </b> : null}{l.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3">
                  <span className={l.signed_at ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{l.signed_at ? `✓ Signed ${dlabel(l.signed_at)}` : l.changed_since ? 'Changed since signed: sign again' : 'Not signed'}</span>
                  {l.quiz_n > 0 && <span className={passed(l.quiz) ? 'font-semibold text-green-700' : l.quiz ? 'font-semibold text-red-700' : 'text-gray-500'}>{l.quiz ? `Quiz ${l.quiz.score}/${l.quiz.total}${passed(l.quiz) ? ' passed' : ' not passed'}` : 'Quiz not taken'}</span>}
                </p>
              </div>))}</div>
          </div>)
      })}
    </div>
  )
}
