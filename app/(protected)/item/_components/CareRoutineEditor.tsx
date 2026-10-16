'use client'
import { useState } from 'react'
import { CHILDREN, type RoutineItem } from '@/lib/caretakerShared'
import { useRoutine } from './CareRoutine'

// For the owners and supervisors (Marian): the list of timed tiles Beatrice
// works through. Changes apply at once; deleted tiles keep their history.
export default function CareRoutineEditor() {
  const { items, error, refresh } = useRoutine()
  const [tab, setTab] = useState<'school' | 'weekend'>('school')
  const [editing, setEditing] = useState<Partial<RoutineItem> | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const shown = items.filter(i => i.day_type === tab).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id)

  async function save() {
    if (!editing) return
    setBusy(true); setMsg('')
    const body = { day_type: editing.day_type ?? tab, time: editing.time ?? '', title: editing.title ?? '', scope: editing.scope ?? 'all', important: !!editing.important }
    try {
      const res = await fetch(editing.id ? `/api/caretaker/routine/${editing.id}` : '/api/caretaker/routine', {
        method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Could not save')
      setEditing(null); await refresh()
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }
  async function remove(id: number) {
    if (!confirm('Remove this tile from the routine? Past records are kept.')) return
    const res = await fetch(`/api/caretaker/routine/${id}`, { method: 'DELETE' })
    if (res.ok) await refresh(); else setMsg('Could not remove it')
  }

  return (
    <div className="max-w-2xl space-y-3 px-3 pb-16 pt-3">
      <h1 className="text-lg font-bold text-gray-900">Daily routine</h1>
      <p className="text-xs text-gray-500">Times are GMT. Tiles marked Important send you a phone alert if they are not recorded 30 minutes after their time.</p>
      <div className="flex gap-2">
        {(['school', 'weekend'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t === 'school' ? 'School days (Mon–Fri)' : 'Weekends'}</button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">Couldn&apos;t load the routine.</p>}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button type="button" onClick={() => setEditing({ day_type: tab, time: '', title: '', scope: 'all', important: false })}
        className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white">+ Add a tile</button>
      <div className="space-y-1.5">
        {shown.map(i => (
          <div key={i.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{i.time}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900">{i.title}</p>
              <p className="text-[11px] text-gray-500">{i.scope === 'all' ? 'All children' : i.scope}{i.important ? ' · Important' : ''}</p>
            </div>
            <button type="button" onClick={() => setEditing(i)} className="text-xs font-bold text-blue-600">Edit</button>
            <button type="button" onClick={() => void remove(i.id)} className="text-xs font-bold text-red-600">Remove</button>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setEditing(null)}>
          <div className="w-full space-y-3 rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
            <p className="text-base font-bold text-gray-900">{editing.id ? 'Edit tile' : 'New tile'}</p>
            <input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="What must be done, e.g. Supervise Fiifi's shower"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
            <div className="flex gap-2">
              <input type="time" value={editing.time ?? ''} onChange={e => setEditing({ ...editing, time: e.target.value })} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm" />
              <select value={editing.scope ?? 'all'} onChange={e => setEditing({ ...editing, scope: e.target.value })} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm">
                <option value="all">All children</option>
                {CHILDREN.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <select value={editing.day_type ?? tab} onChange={e => setEditing({ ...editing, day_type: e.target.value as 'school' | 'weekend' })} className="w-full rounded-xl border border-gray-300 p-3 text-sm">
              <option value="school">School days (Mon–Fri)</option>
              <option value="weekend">Weekends</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={!!editing.important} onChange={e => setEditing({ ...editing, important: e.target.checked })} className="h-5 w-5" />
              Important (phone alert if not recorded 30 minutes after its time)
            </label>
            <button type="button" disabled={busy} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(null)} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
