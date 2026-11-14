'use client'
import { useEffect, useState } from 'react'
import type { Group, GroupItem } from '@/lib/questionGroups'

type Ans = { answer: string; detail: string }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
const btn = (on: boolean, tone: string) => `flex-1 rounded-lg border py-2 text-sm font-bold ${on ? tone : 'border-gray-200 bg-white text-gray-600'}`

// The questions of a question group, shown inside a checklist tile. Answers are saved together; the tile turns done once every required question has one.
export default function GroupForm({ tileId, day, editable, canEdit, onSaved, onClose }: { tileId: number; day: string; editable: boolean; canEdit: boolean; onSaved: (m: string) => void; onClose: () => void }) {
  const [g, setG] = useState<Group | null | undefined>(undefined)
  const [present, setPresent] = useState<string[]>([])
  const [a, setA] = useState<Record<number, Ans>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [why, setWhy] = useState('')
  useEffect(() => {
    fetch(`/api/question-groups/tile/${tileId}?day=${day}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      setG(d?.group ?? null); setPresent(d?.present ?? [])
      const m: Record<number, Ans> = {}; for (const x of d?.answers ?? []) m[x.item_id] = { answer: x.answer, detail: x.detail ?? '' }
      setA(m)
    }).catch(() => setG(null))
  }, [tileId, day])
  if (g === undefined) return <p className="text-xs text-gray-500">Loading the questions…</p>
  if (!g) return <p className="text-xs text-red-600">This question group could not be loaded.</p>
  const set = (id: number, p: Partial<Ans>) => setA(s => ({ ...s, [id]: { answer: s[id]?.answer ?? '', detail: s[id]?.detail ?? '', ...p } }))
  const done = g.items.filter(i => a[i.id]?.answer).length
  async function save() {
    setBusy(true); setErr('')
    const r = await fetch('/api/question-groups/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile_id: tileId, day, answers: g!.items.filter(i => a[i.id]?.answer).map(i => ({ item_id: i.id, answer: a[i.id].answer, detail: a[i.id].detail })) }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Could not save.'); return }
    onSaved(d.complete ? `Done: ${g!.name}` : 'Answers saved. Some questions are still open.')
    if (d.complete) onClose()
  }
  async function notDone() {
    if (why.trim().length < 4) { setErr('Write why it could not be done, then press Not done.'); return }
    setBusy(true); setErr('')
    const r = await fetch('/api/daily-checks/tap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile_id: tileId, value: 'Not done', note: why }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Could not save.'); return }
    onSaved(`Not done: ${g!.name}`); onClose()
  }
  const row = (i: GroupItem, n: number) => {
    const v = a[i.id]
    return (
      <div key={i.id} className="space-y-1.5 rounded-xl border border-gray-200 p-2.5">
        <p className="text-sm font-semibold text-gray-900">{n}. {i.text}{!i.required && <span className="ml-1 text-[12px] font-bold text-gray-400">optional</span>}
          {canEdit && i.law_id && <a href={`/laws?law=${i.law_id}`} className="ml-2 rounded bg-blue-600 px-1 py-0.5 text-[12px] font-extrabold text-white">Law</a>}</p>
        {i.kind === 'tick' && <button type="button" disabled={!editable} onClick={() => set(i.id, { answer: v?.answer === 'yes' ? '' : 'yes' })} className={btn(v?.answer === 'yes', 'border-green-600 bg-green-600 text-white')}>{v?.answer === 'yes' ? '✓ Done' : 'Tap when done'}</button>}
        {i.kind === 'yesno' && (<>
          <div className="flex gap-2">
            <button type="button" disabled={!editable} onClick={() => set(i.id, { answer: 'yes' })} className={btn(v?.answer === 'yes', 'border-green-600 bg-green-600 text-white')}>Yes</button>
            <button type="button" disabled={!editable} onClick={() => set(i.id, { answer: 'no' })} className={btn(v?.answer === 'no', 'border-red-500 bg-red-500 text-white')}>No</button>
          </div>
          {i.detail_on && v?.answer === i.detail_on && <textarea value={v.detail} disabled={!editable} onChange={e => set(i.id, { detail: e.target.value })} placeholder="Say what happened" rows={2} className="w-full rounded-lg border border-gray-300 p-2 text-sm" />}
        </>)}
        {i.kind === 'text' && <input value={v?.answer ?? ''} disabled={!editable} onChange={e => set(i.id, { answer: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-sm" />}
        {i.kind === 'number' && <input type="number" inputMode="decimal" value={v?.answer ?? ''} disabled={!editable} onChange={e => set(i.id, { answer: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-sm" />}
        {i.kind === 'persons' && (() => {
          const sel = (v?.answer ?? '').split(',').filter(s => s && s !== 'none')
          const toggle = (n: string) => { const next = sel.includes(n) ? sel.filter(x => x !== n) : [...sel, n]; set(i.id, { answer: next.length ? next.join(',') : 'none' }) }
          return (<div className="space-y-1">
            <p className="text-[12px] text-gray-500">Tick the people who did NOT. Leave everyone unticked if all did, then press &quot;Nobody&quot;.</p>
            <div className="flex flex-wrap gap-1.5">
              {present.map(n => <button key={n} type="button" disabled={!editable} onClick={() => toggle(n)} className={`rounded-full border px-3 py-1 text-xs font-bold ${sel.includes(n) ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{cap(n)}</button>)}
              <button type="button" disabled={!editable} onClick={() => set(i.id, { answer: 'none' })} className={`rounded-full border px-3 py-1 text-xs font-bold ${v?.answer === 'none' ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>Nobody</button>
            </div>
          </div>)
        })()}
      </div>)
  }
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold uppercase text-gray-500">{done} of {g.items.length} answered</p>
      {g.items.map((i, n) => row(i, n + 1))}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {editable && <button type="button" disabled={busy} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save answers</button>}
      {editable && done === 0 && (<div className="space-y-1.5 pt-1">
        <input value={why} onChange={e => setWhy(e.target.value)} placeholder="Cannot do it? Write why, then press Not done" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
        <button type="button" disabled={busy} onClick={() => void notDone()} className="w-full rounded-xl bg-gray-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">Not done</button>
      </div>)}
    </div>
  )
}
