'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Group, ItemKind } from '@/lib/questionGroups'

type Law = { id: number; category: string | null; subcategory: string | null; law_type: string | null; tile_id: number | null; assignment: string | null; text: string }
type Item = { text: string; kind: ItemKind; detail_on: 'yes' | 'no' | null; law_id: number | null; key: string | null; required: boolean }
type Form = { id?: number; name: string; lawId: number | null; time: string; assignment: string; category: string; bridge: string | null; items: Item[] }
const EMPTY: Form = { name: '', lawId: null, time: '18:00', assignment: 'all', category: '', bridge: null, items: [] }
const KIND_LABEL: Record<ItemKind, string> = { tick: 'Tick when done', yesno: 'Yes / No', text: 'Text answer', number: 'Number', persons: 'Which staff' }
const WHO: Record<string, string> = { all: 'Anyone on shift', opener: 'The opener', closer: 'The closer', managers: 'The manager' }
const first = (t: string) => { const o = t.replace(/\s+/g, ' ').trim(); const m = o.match(/^(.{15,140}?[.!?])(\s|$)/); return (m ? m[1] : o).slice(0, 200) }
const inp = 'w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900'

// Where the owner and Joe build question groups: pick laws (or write questions), group them, and the group becomes one tile for whoever it is assigned to.
export default function GroupsBuilder() {
  const [groups, setGroups] = useState<Group[]>([])
  const [laws, setLaws] = useState<Law[]>([])
  const [f, setF] = useState<Form | null>(null)
  const [pick, setPick] = useState('')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => fetch('/api/question-groups', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) { setGroups(d.groups ?? []); setLaws(d.laws ?? []) } }).catch(() => {})
  useEffect(() => { void load() }, [])
  const lawById = useMemo(() => new Map(laws.map(l => [l.id, l])), [laws])
  const parentChoices = laws.filter(l => l.law_type === 'recurring')
  const shown = laws.filter(l => !q || `${l.category} ${l.subcategory} ${l.text}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60)

  function edit(g: Group) {
    setF({ id: g.id, name: g.name, lawId: g.law_id, time: g.time ?? '18:00', assignment: g.assignment ?? 'all', category: g.category ?? '', bridge: g.bridge,
      items: g.items.map(i => ({ text: i.text, kind: i.kind, detail_on: i.detail_on, law_id: i.law_id, key: i.key, required: i.required })) }); setMsg('')
  }
  const setItem = (n: number, p: Partial<Item>) => setF(s => s && ({ ...s, items: s.items.map((x, i) => i === n ? { ...x, ...p } : x) }))
  const move = (n: number, d: number) => setF(s => { if (!s) return s; const a = [...s.items], m = n + d; if (m < 0 || m >= a.length) return s; [a[n], a[m]] = [a[m], a[n]]; return { ...s, items: a } })
  const addLaw = (id: number) => { const l = lawById.get(id); if (!l) return; setF(s => s && s.items.some(i => i.law_id === id) ? s : s && ({ ...s, items: [...s.items, { text: first(l.text), kind: 'tick', detail_on: null, law_id: id, key: null, required: true }] })) }
  async function save() {
    if (!f) return
    setBusy(true); setMsg('')
    const r = await fetch('/api/question-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, lawId: f.lawId, absorb: true }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not save.'); return }
    setF(null); setMsg('Saved. The group is now one tile on the checklist.'); void load()
  }
  async function remove(g: Group) {
    if (!confirm(`Remove "${g.name}"? The laws in it get their own tiles back.`)) return
    await fetch(`/api/question-groups?id=${g.id}`, { method: 'DELETE' }); void load()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      <div className="flex items-center gap-2">
        <a href="/laws" className="text-xs font-bold text-blue-700 underline">← Company Laws</a>
        <h1 className="text-base font-extrabold text-gray-900">Question groups</h1>
        {!f && <button type="button" onClick={() => { setF({ ...EMPTY }); setMsg('') }} className="ml-auto rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">New group</button>}
      </div>
      <p className="text-[12px] text-gray-600">Group several questions into one tile. The person it is assigned to opens the tile and answers them all. A question taken from a law keeps a Law link, and that law stops appearing as a separate tile.</p>
      {msg && <p className="rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-800">{msg}</p>}

      {!f && groups.map(g => (
        <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">{g.name}</p>
              <p className="text-[11px] text-gray-500">{WHO[g.assignment ?? 'all'] ?? g.assignment} · from {g.time ?? '—'} · {g.items.length} question{g.items.length === 1 ? '' : 's'}{g.law_id ? '' : ' · no law behind it (cannot cost points)'}</p>
            </div>
            <button type="button" onClick={() => edit(g)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">Edit</button>
            <button type="button" onClick={() => void remove(g)} className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">Remove</button>
          </div>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[12px] text-gray-700">{g.items.map(i => <li key={i.id}>{i.text} <span className="text-[10px] text-gray-400">({KIND_LABEL[i.kind]})</span></li>)}</ol>
        </div>))}
      {!f && groups.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">No groups yet. Press New group.</p>}

      {f && (
        <div className="space-y-3 rounded-xl border-2 border-blue-300 bg-white p-3">
          <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Group name, for example Opening questions" className={inp} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-gray-700">Who answers it
              <select value={f.assignment} onChange={e => setF({ ...f, assignment: e.target.value })} className={`${inp} mt-0.5`} disabled={!!f.lawId}>{Object.entries(WHO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-gray-700">Due from
              <input type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} className={`${inp} mt-0.5`} disabled={!!f.lawId} /></label>
          </div>
          <label className="block text-[11px] font-semibold text-gray-700">The law behind this tile (it decides the schedule and costs the point if left undone)
            <select value={f.lawId ?? ''} onChange={e => setF({ ...f, lawId: e.target.value ? Number(e.target.value) : null })} className={`${inp} mt-0.5`}>
              <option value="">None (own schedule above; no penalty)</option>
              {parentChoices.map(l => <option key={l.id} value={l.id}>{(l.category ?? '') + ' · ' + first(l.text).slice(0, 80)}</option>)}
            </select></label>

          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase text-gray-500">Questions</p>
            {f.items.map((i, n) => (
              <div key={n} className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2">
                <textarea value={i.text} onChange={e => setItem(n, { text: e.target.value })} rows={2} className={inp} />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <select value={i.kind} onChange={e => setItem(n, { kind: e.target.value as ItemKind })} className="rounded border border-gray-300 bg-white p-1">{(Object.keys(KIND_LABEL) as ItemKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                  {i.kind === 'yesno' && <select value={i.detail_on ?? ''} onChange={e => setItem(n, { detail_on: (e.target.value || null) as 'yes' | 'no' | null })} className="rounded border border-gray-300 bg-white p-1"><option value="">No detail asked</option><option value="yes">Ask what happened on Yes</option><option value="no">Ask what happened on No</option></select>}
                  <label className="flex items-center gap-1 font-semibold"><input type="checkbox" checked={i.required} onChange={e => setItem(n, { required: e.target.checked })} />Required</label>
                  {i.law_id && <a href={`/laws?law=${i.law_id}`} className="rounded bg-blue-600 px-1.5 py-0.5 font-extrabold text-white">Law</a>}
                  <span className="ml-auto flex gap-1">
                    <button type="button" onClick={() => move(n, -1)} className="rounded bg-gray-200 px-2 py-0.5 font-bold">↑</button>
                    <button type="button" onClick={() => move(n, 1)} className="rounded bg-gray-200 px-2 py-0.5 font-bold">↓</button>
                    <button type="button" onClick={() => setF({ ...f, items: f.items.filter((_, k) => k !== n) })} className="rounded bg-red-100 px-2 py-0.5 font-bold text-red-700">Remove</button>
                  </span>
                </div>
              </div>))}
            <button type="button" onClick={() => setF({ ...f, items: [...f.items, { text: '', kind: 'yesno', detail_on: null, law_id: null, key: null, required: true }] })} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">+ Write a question</button>
          </div>

          <div className="space-y-1.5 rounded-lg border border-dashed border-gray-300 p-2">
            <p className="text-xs font-extrabold uppercase text-gray-500">Add a question from a law</p>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the laws" className={inp} />
            <div className="flex gap-1.5">
              <select value={pick} onChange={e => setPick(e.target.value)} className={inp}><option value="">Choose a law…</option>{shown.map(l => <option key={l.id} value={l.id}>{(l.category ?? '') + ' · ' + first(l.text).slice(0, 90)}</option>)}</select>
              <button type="button" disabled={!pick} onClick={() => { addLaw(Number(pick)); setPick('') }} className="shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-40">Add</button>
            </div>
            <p className="text-[10px] text-gray-500">The law&apos;s own tile is replaced by this question, so it is never asked twice.</p>
          </div>

          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">Save group</button>
            <button type="button" onClick={() => { setF(null); setMsg('') }} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700">Cancel</button>
          </div>
        </div>)}
    </div>
  )
}
