'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CHECK_SECTIONS, FREQUENCIES, KIND_LABEL, LOG_CATEGORIES_FOR_TILES, TILE_KINDS, WEEKDAYS, WEEKDAY_LABEL } from '@/lib/dailyChecksShared'

type Tile = {
  id: number; section: string; time: string | null; title: string; icon: string; how: string | null; kind: string; prop_filter: string | null
  frequency: string; weekday: string | null; position: number; minutes: number | null; days: string | null; ask: string | null
  ok_label: string | null; issue_label: string | null; log_category: string | null; needs_photo: boolean; active: boolean; last_done: string | null
}
type Draft = {
  id?: number; icon: string; title: string; section: string; kind: string; time: string; minutes: string; frequency: string; weekday: string
  days: string[]; how: string; ask: string; ok_label: string; issue_label: string; log_category: string; needs_photo: boolean; prop_filter: string
}
const json = { 'Content-Type': 'application/json' }
const blank = (section = 'Daytime'): Draft => ({ icon: '✅', title: '', section, kind: 'tap', time: '', minutes: '5', frequency: 'daily', weekday: '', days: [], how: '', ask: '', ok_label: '', issue_label: '', log_category: '', needs_photo: false, prop_filter: '' })
const toDraft = (t: Tile): Draft => ({
  id: t.id, icon: t.icon, title: t.title, section: t.section, kind: t.kind, time: t.time ?? '', minutes: String(t.minutes ?? 5), frequency: t.frequency, weekday: t.weekday ?? '',
  days: t.days ? t.days.split(',') : [], how: t.how ?? '', ask: t.ask ?? '', ok_label: t.ok_label ?? '', issue_label: t.issue_label ?? '', log_category: t.log_category ?? '', needs_photo: t.needs_photo, prop_filter: t.prop_filter ?? '',
})
const daysText = (d: string | null) => d ? d.split(',').map(x => WEEKDAY_LABEL[x]?.slice(0, 3)).join(' ') : 'Every day'
const inp = 'w-full rounded-xl border border-gray-300 p-2.5 text-sm'
const lab = 'mb-0.5 block text-[12px] font-bold uppercase text-gray-500'

export default function ManageTilesClient() {
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  const [error, setError] = useState('')
  const [group, setGroup] = useState('')
  const [status, setStatus] = useState<'active' | 'stopped' | 'all'>('active')
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/daily-checks/tiles', { cache: 'no-store' }); const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Could not load')
      setTiles(d.tiles); setError('')
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!tiles) return
    const id = Number(new URLSearchParams(window.location.search).get('tile'))
    if (id) { const t = tiles.find(x => x.id === id); if (t) setDraft(toDraft(t)) }
  }, [tiles === null]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const all = Array.from(new Set((tiles ?? []).map(t => t.section)))
    return [...CHECK_SECTIONS.filter(g => all.includes(g)), ...all.filter(g => !CHECK_SECTIONS.includes(g)).sort()]
  }, [tiles])
  const shown = (tiles ?? []).filter(t => (!group || t.section === group) && (status === 'all' || (status === 'active') === t.active) && (!q.trim() || (t.title + ' ' + t.section).toLowerCase().includes(q.trim().toLowerCase())))
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function act(url: string, init: RequestInit, ok: string) {
    const r = await fetch(url, init); const d = await r.json().catch(() => ({}))
    if (!r.ok) { flash(d.error ?? 'Failed'); return false }
    flash(ok); await load(); return true
  }
  const patch = (t: Tile, body: object, ok: string) => act(`/api/daily-checks/${t.id}`, { method: 'PATCH', headers: json, body: JSON.stringify(body) }, ok)
  async function rename(g: string) {
    const to = prompt(`Rename the group "${g}" to:`, g); if (!to || to.trim() === g) return
    await act('/api/daily-checks/sections', { method: 'PUT', headers: json, body: JSON.stringify({ from: g, to }) }, 'Group renamed')
  }

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/todo" className="text-sm text-gray-500">&larr; Waiting for team</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Tile Manager</h1>
        <button type="button" onClick={() => setDraft(blank(group || 'Daytime'))} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white">+ New tile</button>
      </div>
      <p className="mb-2 text-[12px] text-gray-500">Add tiles, stop tiles that should no longer appear (they can be restored), and set the time, days, how often, the group and the work minutes. Past records are never deleted.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <select value={group} onChange={e => setGroup(e.target.value)} className="rounded-lg border border-gray-300 p-1.5 text-xs"><option value="">All groups</option>{groups.map(g => <option key={g}>{g}</option>)}</select>
        {(['active', 'stopped', 'all'] as const).map(s => <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-bold ${status === s ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{s === 'active' ? 'Showing' : s === 'stopped' ? 'Stopped' : 'All'}</button>)}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tiles" className="min-w-[8rem] flex-1 rounded-lg border border-gray-300 p-1.5 text-xs" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tiles && !error && <p className="text-sm text-gray-400">Loading…</p>}
      {(group ? [group] : groups).map(g => {
        const rows = shown.filter(t => t.section === g); if (!rows.length) return null
        return (
          <div key={g} className="mb-3">
            <div className="mb-1 flex items-center gap-2"><p className="text-xs font-extrabold uppercase text-[#14213D]">{g} · {rows.length}</p><button type="button" onClick={() => void rename(g)} className="text-[12px] font-semibold text-blue-700 underline">Rename group</button></div>
            <div className="space-y-1">
              {rows.map(t => (
                <div key={t.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${t.active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100 opacity-70'}`}>
                  <span className="text-lg leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-gray-900">{t.title}</p>
                    <p className="text-[12px] text-gray-500">{t.frequency === 'daily' ? (t.time ?? 'no time') : t.frequency}{t.frequency === 'daily' ? ` · ${daysText(t.days)}` : ''} · {t.minutes ?? 5} min · {KIND_LABEL[t.kind]?.split(' (')[0]}{t.last_done ? ` · last done ${t.last_done}` : ' · never done'}</p>
                  </div>
                  <button type="button" onClick={() => void patch(t, { move: 'up' }, 'Moved')} className="px-1 text-sm text-gray-500" aria-label="Move up">▲</button>
                  <button type="button" onClick={() => void patch(t, { move: 'down' }, 'Moved')} className="px-1 text-sm text-gray-500" aria-label="Move down">▼</button>
                  <button type="button" onClick={() => setDraft(toDraft(t))} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Edit</button>
                  {t.active
                    ? <button type="button" onClick={() => { if (confirm('Stop this tile from appearing? Past records are kept and you can restore it.')) void patch(t, { active: false }, 'Stopped') }} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Stop</button>
                    : <button type="button" onClick={() => void patch(t, { active: true }, 'Restored')} className="rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-700">Restore</button>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {tiles && shown.length === 0 && <p className="text-sm text-gray-400">No tiles match.</p>}
      {draft && <Editor d={draft} groups={groups} onClose={() => setDraft(null)} onSaved={m => { flash(m); setDraft(null); void load() }} />}
      {msg && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">{msg}</div>}
    </div>
  )
}

function Editor({ d: start, groups, onClose, onSaved }: { d: Draft; groups: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [d, setD] = useState<Draft>(start)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(p => ({ ...p, [k]: v }))
  async function save() {
    setBusy(true); setErr('')
    const r = await fetch(d.id ? `/api/daily-checks/${d.id}` : '/api/daily-checks', { method: d.id ? 'PUT' : 'POST', headers: json, body: JSON.stringify({ ...d, minutes: Number(d.minutes) }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) setErr(j.error ?? 'Could not save'); else onSaved(d.id ? 'Tile saved' : 'Tile added')
  }
  const daily = d.frequency === 'daily'
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">{d.id ? 'Edit tile' : 'New tile'}</p>
        <div className="flex gap-2">
          <input value={d.icon} onChange={e => set('icon', e.target.value)} maxLength={8} className="w-16 rounded-xl border border-gray-300 p-2.5 text-center text-2xl" aria-label="Picture" />
          <input value={d.title} onChange={e => set('title', e.target.value)} placeholder="What must be done" className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lab}>Group</label><input list="tm-groups" value={d.section} onChange={e => set('section', e.target.value)} className={inp} /><datalist id="tm-groups">{groups.map(g => <option key={g} value={g} />)}</datalist></div>
          <div><label className={lab}>Kind of tile</label><select value={d.kind} onChange={e => set('kind', e.target.value)} className={inp}>{TILE_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
          <div><label className={lab}>How often</label><select value={d.frequency} onChange={e => set('frequency', e.target.value)} className={inp}>{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
          <div><label className={lab}>Work minutes credited</label><input type="number" min={0} max={240} value={d.minutes} onChange={e => set('minutes', e.target.value)} className={inp} /></div>
          {daily && <div><label className={lab}>Time due</label><input type="time" value={d.time} onChange={e => set('time', e.target.value)} className={inp} /></div>}
          {d.frequency === 'weekly' && <div><label className={lab}>Weekday</label><select value={d.weekday} onChange={e => set('weekday', e.target.value)} className={inp}><option value="">Any day that week</option>{WEEKDAYS.map(w => <option key={w} value={w}>{WEEKDAY_LABEL[w]}</option>)}</select></div>}
        </div>
        {daily && (
          <div><label className={lab}>Days it appears (none ticked = every day)</label>
            <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map(w => <button key={w} type="button" onClick={() => set('days', d.days.includes(w) ? d.days.filter(x => x !== w) : [...d.days, w])} className={`rounded-full px-3 py-1.5 text-xs font-bold ${d.days.includes(w) ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{WEEKDAY_LABEL[w].slice(0, 3)}</button>)}</div>
          </div>
        )}
        {d.kind !== 'tap' && d.kind !== 'properties' && (
          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <div><label className={lab}>Question shown to staff</label><input value={d.ask} onChange={e => set('ask', e.target.value)} placeholder="e.g. Is everyone wearing the company T-shirt?" className={inp} /></div>
            {d.kind === 'question' && <div className="grid grid-cols-2 gap-2"><div><label className={lab}>All-good button</label><input value={d.ok_label} onChange={e => set('ok_label', e.target.value)} placeholder="None today" className={inp} /></div><div><label className={lab}>Report button</label><input value={d.issue_label} onChange={e => set('issue_label', e.target.value)} placeholder="Report a problem" className={inp} /></div></div>}
            <div><label className={lab}>Also save into this log</label><select value={d.log_category} onChange={e => set('log_category', e.target.value)} className={inp}>{LOG_CATEGORIES_FOR_TILES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}</select></div>
            {d.kind === 'entry' && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.needs_photo} onChange={e => set('needs_photo', e.target.checked)} /> A photo is required</label>}
          </div>
        )}
        {d.kind === 'properties' && <div><label className={lab}>Words in the property name</label><input value={d.prop_filter} onChange={e => set('prop_filter', e.target.value)} placeholder="e.g. printer, laptop" className={inp} /></div>}
        <div><label className={lab}>How (shown to staff)</label><textarea value={d.how} onChange={e => set('how', e.target.value)} rows={2} className={inp} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || !d.title.trim() || !d.section.trim()} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save tile'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}
