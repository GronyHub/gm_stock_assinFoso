'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATEGORY_KEYWORDS, DAY_CODES, DAY_NAMES, LAW_CATEGORIES, LAW_FREQUENCIES, LAW_TYPES, PROOFS, UNCATEGORISED, scheduleText } from '@/lib/lawCategories'
import CustomerServiceCode from '../item/_components/CustomerServiceCode'
import CategoryTraining, { hasTraining, useQuizMine } from './CategoryTraining'

type Law = {
  id: number; text: string; scope_key: string; category: string | null; subcategory: string | null; law_type: string
  days: string | null; law_time: string | null; frequency: string | null; minutes: number | null; dos: string | null; donts: string | null
  status?: string; tile_id?: number | null; proof?: string; points?: number
}
type Draft = { id?: number; text: string; category: string; subcategory: string; law_type: string; days: string[]; law_time: string; frequency: string; minutes: string; dos: string; donts: string; proof: string; points: string }
const json = { 'Content-Type': 'application/json' }
const typeLabel = (k: string) => LAW_TYPES.find(t => t.key === k)?.label ?? k
const typeCls: Record<string, string> = { recurring: 'bg-indigo-100 text-indigo-800', standing: 'bg-gray-100 text-gray-700', app: 'bg-sky-100 text-sky-800' }
const inp = 'w-full rounded-xl border border-gray-300 p-2.5 text-sm'
const lab = 'mb-0.5 block text-[11px] font-bold uppercase text-gray-500'
const lines = (s: string | null) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean)
const toDraft = (l: Law): Draft => ({ id: l.id, text: l.text, category: l.category ?? '', subcategory: l.subcategory ?? '', law_type: l.law_type, days: l.days ? l.days.split(',') : [], law_time: l.law_time ?? '', frequency: l.frequency ?? '', minutes: l.minutes ? String(l.minutes) : '', dos: l.dos ?? '', donts: l.donts ?? '', proof: l.proof ?? 'tick', points: String(l.points ?? 1) })
const blank = (category: string): Draft => ({ text: '', category, subcategory: '', law_type: 'standing', days: [], law_time: '', frequency: '', minutes: '', dos: '', donts: '', proof: 'tick', points: '1' })

// Company Laws: category tiles, then each category's subcategories with the law, its dos and don'ts and its schedule.
export default function LawsClient({ canManage }: { canManage: boolean }) {
  const [laws, setLaws] = useState<Law[] | null>(null)
  const [error, setError] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState('')
  const { mine: quizMine, reload: reloadQuiz } = useQuizMine()

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/page-laws', { cache: 'no-store' }); const d = await r.json()
      if (!r.ok || !Array.isArray(d)) throw new Error(d.error ?? 'Could not load')
      setLaws(d); setError('')
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('cat'); if (c) setCat(c) }, [])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const byCat = useMemo(() => {
    const m = new Map<string, Law[]>()
    for (const l of laws ?? []) { const k = l.category ?? UNCATEGORISED; if (!m.has(k)) m.set(k, []); m.get(k)!.push(l) }
    return m
  }, [laws])
  const tiles = [...LAW_CATEGORIES.map(c => ({ ...c })), ...(canManage && byCat.has(UNCATEGORISED) ? [{ key: UNCATEGORISED, icon: '❓', blurb: 'Laws added the old way. Give each a category.' }] : [])]
  const searching = q.trim().length > 1
  const hits = searching ? (laws ?? []).filter(l => (l.text + ' ' + (l.subcategory ?? '') + ' ' + (l.dos ?? '') + ' ' + (l.donts ?? '')).toLowerCase().includes(q.trim().toLowerCase())) : []

  async function remove(l: Law) {
    if (!confirm('Delete this law? It disappears from the Handbook and the page it was written on.')) return
    const r = await fetch(`/api/page-laws/${l.id}`, { method: 'DELETE' })
    if (r.ok) { flash('Law deleted'); void load() } else flash('Could not delete')
  }

  async function approve(body: { id?: number; category?: string }) {
    const r = await fetch('/api/page-laws/approve', { method: 'POST', headers: json, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({}))
    if (r.ok) { flash(d.approved ? `Approved ${d.approved}. Tiles are in the Daily Checklist.` : 'Tiles created'); void load() } else flash(d.error ?? 'Could not approve')
  }

  const LawCard = ({ l }: { l: Law }) => {
    const sched = scheduleText(l)
    return (
      <div className={`rounded-xl border p-3 ${l.status === 'draft' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
        {l.status === 'draft' && <p className="mb-1 text-[10px] font-extrabold uppercase text-amber-700">Draft: not in force yet. Read it, edit if needed, then approve.</p>}
        <p className="whitespace-pre-line text-sm text-gray-900">{l.text}</p>
        {lines(l.dos).length > 0 && <ul className="mt-2 space-y-0.5">{lines(l.dos).map((x, i) => <li key={i} className="text-[13px] text-green-800">✓ <span className="text-gray-800">{x}</span></li>)}</ul>}
        {lines(l.donts).length > 0 && <ul className="mt-1 space-y-0.5">{lines(l.donts).map((x, i) => <li key={i} className="text-[13px] text-red-700">✗ <span className="text-gray-800">{x}</span></li>)}</ul>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeCls[l.law_type] ?? typeCls.standing}`}>{typeLabel(l.law_type)}</span>
          {(l.points ?? 1) > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">⚖ {l.points ?? 1} point{(l.points ?? 1) === 1 ? '' : 's'} if broken</span>}
          {l.tile_id && <a href="/standards" className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">✅ In the Daily Checklist</a>}
          {sched && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sched.startsWith('No schedule') ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-800'}`}>🗓 {sched}</span>}
          {canManage && <span className="ml-auto flex gap-1">
            {l.status === 'draft' && <button type="button" onClick={() => void approve({ id: l.id })} className="rounded-lg bg-green-600 px-2 py-1 text-xs font-bold text-white">Approve</button>}
            <button type="button" onClick={() => setDraft(toDraft(l))} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Edit</button>
            <button type="button" onClick={() => void remove(l)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Delete</button>
          </span>}
        </div>
      </div>
    )
  }

  const [oldTiles, setOldTiles] = useState<{ id: number; title: string; section: string; law_id: number | null; created_by: string | null; active: boolean }[]>([])
  const [pick, setPick] = useState<Set<number>>(new Set())
  useEffect(() => {
    setPick(new Set())
    if (!canManage || !cat) { setOldTiles([]); return }
    fetch('/api/daily-checks/tiles').then(r => r.ok ? r.json() : null).then(d => d?.tiles && setOldTiles(d.tiles)).catch(() => {})
  }, [cat, canManage, laws])
  const kw = cat && CATEGORY_KEYWORDS[cat] ? new RegExp(CATEGORY_KEYWORDS[cat], 'i') : null
  const candidates = kw ? oldTiles.filter(t => t.active && !t.law_id && t.created_by === 'template' && kw.test(t.title)) : []
  async function stopPicked() {
    if (!pick.size || !confirm(`Stop ${pick.size} old tile${pick.size === 1 ? '' : 's'}? Their past records are kept and you can restore them in the Tile Manager.`)) return
    for (const id of pick) await fetch(`/api/daily-checks/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ active: false }) })
    flash('Old tiles stopped'); setPick(new Set()); setOldTiles(o => o.map(t => pick.has(t.id) ? { ...t, active: false } : t))
  }
  const catInfo = tiles.find(c => c.key === cat)
  const catLaws = cat ? (byCat.get(cat) ?? []) : []
  const subs = Array.from(new Set(catLaws.map(l => l.subcategory ?? 'General')))

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Company Laws</h1>
        {canManage && <a href="/penalties" className="text-xs font-semibold text-red-700 underline">Penalties</a>}
        <a href="/standards" className="text-xs font-semibold text-blue-700 underline">Daily Checklist</a>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search all laws, for example personal number" className="mb-3 w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!laws && !error && <p className="text-sm text-gray-400">Loading…</p>}

      {laws && searching && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">{hits.length} law{hits.length === 1 ? '' : 's'} found</p>
          {hits.map(l => (<div key={l.id}><button type="button" onClick={() => { setQ(''); setCat(l.category ?? UNCATEGORISED) }} className="mb-0.5 text-[11px] font-bold text-blue-700 underline">{l.category ?? UNCATEGORISED}{l.subcategory ? ` › ${l.subcategory}` : ''}</button><LawCard l={l} /></div>))}
        </div>
      )}

      {laws && !searching && !cat && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map(c => {
            const list = byCat.get(c.key) ?? []
            const sched = list.filter(l => l.law_type === 'recurring').length
            return (
              <button key={c.key} type="button" onClick={() => setCat(c.key)} className="flex min-h-[130px] flex-col items-center rounded-2xl border-2 border-gray-200 bg-white p-3 text-center active:opacity-70">
                <span className="text-4xl leading-none">{c.icon}</span>
                <span className="mt-2 text-sm font-bold leading-tight text-gray-900">{c.key}</span>
                <span className="mt-1 text-[10px] leading-tight text-gray-500">{c.blurb}</span>
                {hasTraining(c.key) && <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${quizMine[c.key]?.passed ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>{quizMine[c.key]?.passed ? '🎬 Quiz passed' : '🎬 Video + quiz'}</span>}
                <span className="mt-auto pt-2 text-[11px] font-bold text-[#14213D]">{list.filter(l => l.status !== 'draft').length} law{list.filter(l => l.status !== 'draft').length === 1 ? '' : 's'}{sched ? ` · ${sched} scheduled` : ''}</span>
                {list.some(l => l.status === 'draft') && <span className="text-[10px] font-extrabold text-amber-700">{list.filter(l => l.status === 'draft').length} draft{list.filter(l => l.status === 'draft').length === 1 ? '' : 's'} to approve</span>}
              </button>
            )
          })}
        </div>
      )}

      {laws && !searching && cat && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCat(null)} className="text-sm font-semibold text-blue-700">&larr; All categories</button>
            {canManage && catLaws.some(l => l.status === 'draft') && <button type="button" onClick={() => { if (confirm(`Approve all ${catLaws.filter(l => l.status === 'draft').length} draft laws in ${cat}? Their tiles go into the Daily Checklist and the old tiles they replace are stopped.`)) void approve({ category: cat }) }} className="ml-auto rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white">Approve all drafts ({catLaws.filter(l => l.status === 'draft').length})</button>}
            {canManage && cat !== UNCATEGORISED && <button type="button" onClick={() => setDraft(blank(cat))} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white">+ Add law</button>}
          </div>
          <div className="flex items-center gap-2"><span className="text-3xl">{catInfo?.icon}</span><div><p className="text-lg font-bold text-[#14213D]">{cat}</p><p className="text-xs text-gray-500">{catInfo?.blurb}</p></div></div>
          {cat && hasTraining(cat) && <CategoryTraining cat={cat} result={quizMine[cat]} onDone={() => void reloadQuiz()} />}
          {cat === 'Customer service' && (
            <details className="rounded-xl border border-green-300 bg-green-50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-gray-900">🤝 The Customer Service Code (CS-1 to CS-33)</summary>
              <div className="bg-white"><CustomerServiceCode /></div>
            </details>
          )}
          {subs.map(sub => (
            <div key={sub}>
              <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{sub}</p>
              <div className="space-y-2">{catLaws.filter(l => (l.subcategory ?? 'General') === sub).map(l => <LawCard key={l.id} l={l} />)}</div>
            </div>
          ))}
          {canManage && candidates.length > 0 && (
            <details className="rounded-xl border border-gray-300 bg-gray-50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-gray-900">Old checklist tiles that may be replaced by these laws ({candidates.length})</summary>
              <div className="space-y-1 p-2">
                <p className="text-[11px] text-gray-600">These came from the old Standards list and have no law behind them. Tick the ones the laws above now cover, then stop them. Nothing is stopped until you confirm.</p>
                <div className="max-h-72 space-y-1 overflow-y-auto">{candidates.map(t => (
                  <label key={t.id} className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs"><input type="checkbox" checked={pick.has(t.id)} onChange={() => setPick(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} className="mt-0.5" /><span><b className="text-gray-500">{t.section}</b> · {t.title}</span></label>
                ))}</div>
                <button type="button" disabled={!pick.size} onClick={() => void stopPicked()} className="w-full rounded-xl bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-40">Stop {pick.size || ''} selected tile{pick.size === 1 ? '' : 's'}</button>
              </div>
            </details>
          )}
          {catLaws.length === 0 && <p className="text-sm text-gray-400">No laws in this category yet.{canManage ? ' Use + Add law.' : ''}</p>}
        </div>
      )}

      {draft && <Editor d={draft} subs={Array.from(new Set((laws ?? []).map(l => l.subcategory).filter(Boolean) as string[]))} onClose={() => setDraft(null)} onSaved={m => { flash(m); setDraft(null); void load() }} />}
      {msg && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">{msg}</div>}
    </div>
  )
}

function Editor({ d: start, subs, onClose, onSaved }: { d: Draft; subs: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [d, setD] = useState<Draft>(start)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(p => ({ ...p, [k]: v }))
  async function save() {
    setBusy(true); setErr('')
    const r = await fetch(d.id ? `/api/page-laws/${d.id}` : '/api/page-laws', { method: d.id ? 'PUT' : 'POST', headers: json, body: JSON.stringify({ ...d, minutes: Number(d.minutes) || null }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) setErr(j.error ?? 'Could not save'); else onSaved(d.id ? 'Law saved' : 'Law added')
  }
  const recurring = d.law_type === 'recurring'
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">{d.id ? 'Edit law' : 'New law'}</p>
        <div><label className={lab}>The law</label><textarea value={d.text} onChange={e => set('text', e.target.value)} rows={4} className={inp} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lab}>Category (required)</label><select value={d.category} onChange={e => set('category', e.target.value)} className={inp}><option value="" disabled>Choose…</option>{LAW_CATEGORIES.map(c => <option key={c.key}>{c.key}</option>)}</select></div>
          <div><label className={lab}>Subcategory</label><input list="law-subs" value={d.subcategory} onChange={e => set('subcategory', e.target.value)} className={inp} /><datalist id="law-subs">{subs.map(s => <option key={s} value={s} />)}</datalist></div>
        </div>
        <div><label className={lab}>Type</label>
          <div className="space-y-1">{LAW_TYPES.map(t => (
            <label key={t.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2 ${d.law_type === t.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <input type="radio" checked={d.law_type === t.key} onChange={() => set('law_type', t.key)} className="mt-1" /><span><b className="text-sm">{t.label}</b><span className="block text-[11px] text-gray-600">{t.help}</span></span>
            </label>))}</div></div>
        {recurring && (
          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <div><label className={lab}>Days (none ticked = every day)</label>
              <div className="flex flex-wrap gap-1.5">{DAY_CODES.map(w => <button key={w} type="button" onClick={() => set('days', d.days.includes(w) ? d.days.filter(x => x !== w) : [...d.days, w])} className={`rounded-full px-3 py-1.5 text-xs font-bold ${d.days.includes(w) ? 'bg-[#14213D] text-white' : 'bg-white text-gray-700'}`}>{DAY_NAMES[w].slice(0, 3)}</button>)}</div></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className={lab}>How often</label><select value={d.frequency} onChange={e => set('frequency', e.target.value)} className={inp}><option value="">Choose…</option>{LAW_FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
              <div><label className={lab}>Time</label><input type="time" value={d.law_time} onChange={e => set('law_time', e.target.value)} className={inp} /></div>
              <div><label className={lab}>Minutes</label><input type="number" min={1} max={240} value={d.minutes} onChange={e => set('minutes', e.target.value)} className={inp} /></div>
            </div>
            <div><label className={lab}>How staff prove it</label><select value={d.proof} onChange={e => set('proof', e.target.value)} className={inp}>{PROOFS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
          </div>
        )}
        <div><label className={lab}>Penalty points if this law is broken</label><input type="number" min={0} max={20} value={d.points} onChange={e => set('points', e.target.value)} className={inp + ' w-24'} /></div>
        <div><label className={lab}>Do (one per line, optional)</label><textarea value={d.dos} onChange={e => set('dos', e.target.value)} rows={3} className={inp} /></div>
        <div><label className={lab}>Don&apos;t (one per line, optional)</label><textarea value={d.donts} onChange={e => set('donts', e.target.value)} rows={3} className={inp} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || !d.text.trim() || !d.category} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save law'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}
