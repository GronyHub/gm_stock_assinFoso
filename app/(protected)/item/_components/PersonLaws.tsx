'use client'
import { useEffect, useState } from 'react'

type L = { id: number; code: string | null; title: string; category: string | null }
type V = { key: string; label: string; watched_at: string | null; due: string | null; overdue: boolean }
type Q = { day: string; correct: boolean | null; title: string | null }
type Data = { staff: string; laws: L[]; videos?: V[]; questions?: Q[] }

// The laws in force for one person, by category. Nobody signs them and the per-law quizzes were dropped;
// each law's video and the daily law question are on the Laws page.
export default function PersonLaws({ staff }: { staff: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    setD(null); setErr('')
    fetch(`/api/law-record?staff=${encodeURIComponent(staff)}`, { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Could not load'); setD(j) }).catch(e => setErr(e.message))
  }, [staff])
  if (err) return <p className="p-3 text-sm text-red-600">{err}</p>
  if (!d) return <p className="p-3 text-sm text-gray-400">Loading…</p>
  const byCat = new Map<string, L[]>()
  for (const l of d.laws) { const k = l.category ?? 'Other'; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(l) }
  return (
    <div className="space-y-3 p-2">
      <p className="rounded-xl bg-gray-50 p-2 text-[11px] font-semibold text-gray-700">{d.laws.length} laws are in force for everyone; nobody signs them.</p>
      {d.videos && d.videos.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">Tile videos ({d.videos.filter(v => v.watched_at).length}/{d.videos.length} watched to the end)</p>
          <div className="flex flex-wrap gap-1">{d.videos.map(v => (
            <span key={v.key} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${v.watched_at ? 'bg-green-100 text-green-800' : v.overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
              {v.watched_at ? '✓' : v.overdue ? '✗' : '…'} {v.label}{v.watched_at ? ` · ${String(v.watched_at).slice(0, 10)}` : v.due ? ` · due ${v.due}` : ''}</span>))}</div>
        </div>)}
      {d.questions && (
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">Question of the day, last 30 days: {d.questions.filter(q => q.correct === true).length} right, {d.questions.filter(q => q.correct === false).length} wrong, {d.questions.filter(q => q.correct == null).length} not answered</p>
          <div className="space-y-0.5">{d.questions.slice(0, 10).map(q => (
            <p key={q.day} className="text-[11px] text-gray-800"><b className={q.correct ? 'text-green-700' : q.correct === false ? 'text-red-700' : 'text-gray-500'}>{q.correct ? 'Right' : q.correct === false ? 'Wrong' : 'Not answered'}</b> · {q.day}{q.title ? ` · ${q.title.slice(0, 70)}` : ''}</p>))}
            {d.questions.length === 0 && <p className="text-[11px] text-gray-500">No questions yet.</p>}</div>
        </div>)}
      {Array.from(byCat.entries()).map(([cat, list]) => (
        <div key={cat}>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{cat}</p>
          <div className="space-y-1">{list.map(l => (
            <div key={l.id} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs">
              <p className="font-semibold text-gray-900">{l.code ? <b>{l.code} </b> : null}{l.title}</p>
            </div>))}</div>
        </div>))}
    </div>
  )
}
