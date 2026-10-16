'use client'
import { useCallback, useEffect, useState } from 'react'
import { JOB_SECTIONS } from '@/lib/caretakerShared'
import { hhmm } from './careUtils'

type Obs = { id: number; kind: 'concern' | 'good' | 'note'; note: string; obs_date: string; logged_by: string }
type Rule = { id: number; section: string; text: string; version: number; signs: { signed_name: string; signed_by: string; signed_at: string }[]; obs?: Obs[] }
const KIND_STYLE = { concern: 'bg-red-100 text-red-800', good: 'bg-green-100 text-green-800', note: 'bg-gray-100 text-gray-700' } as const
const day = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Private observations about the caretaker, shown under a rule (or under "General").
// Only people who may see C&H ever receive this data.
function ObsBlock({ ruleId, list, onChanged, open: startOpen = false }: { ruleId: number | null; list: Obs[]; onChanged: () => void; open?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'concern' | 'good' | 'note'>('note')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [err, setErr] = useState('')
  async function save() {
    const r = await fetch('/api/caretaker/job/obs', { method: 'POST', headers: json, body: JSON.stringify({ rule_id: ruleId, kind, note, date }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d.error ?? 'Could not save'); return }
    setNote(''); setAdding(false); setErr(''); setOpen(true); onChanged()
  }
  return (
    <div className="mt-2 rounded-lg bg-amber-50 p-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(o => !o)} className="text-xs font-bold text-amber-900">👁️ Observations ({list.length}) {open ? '▲' : '▼'}</button>
        <button type="button" onClick={() => { setAdding(a => !a); setOpen(true) }} className="text-xs font-semibold text-blue-700">+ Add</button>
      </div>
      {open && list.map(o => (
        <div key={o.id} className="mt-1.5 flex items-start gap-2 text-xs">
          <span className={`shrink-0 rounded px-1.5 py-0.5 font-bold ${KIND_STYLE[o.kind]}`}>{o.kind === 'concern' ? 'Concern' : o.kind === 'good' ? 'Good' : 'Note'}</span>
          <p className="flex-1 text-gray-800"><span className="font-semibold">{day(o.obs_date)}</span> · {o.logged_by}: {o.note}</p>
          <button type="button" onClick={async () => { if (confirm('Remove this observation?')) { await fetch(`/api/caretaker/job/obs/${o.id}`, { method: 'DELETE' }); onChanged() } }} className="text-gray-400">✕</button>
        </div>
      ))}
      {adding && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(['concern', 'good', 'note'] as const).map(k => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind === k ? 'bg-gray-800 text-white' : KIND_STYLE[k]}`}>{k === 'concern' ? 'Concern' : k === 'good' ? 'Good' : 'Note'}</button>
            ))}
            <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} className="rounded-lg border border-gray-300 p-1.5 text-xs" />
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="What did you observe?" className="w-full rounded-xl border border-gray-300 p-2 text-sm" />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="button" disabled={!note.trim()} onClick={() => void save()} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Save observation</button>
        </div>
      )}
    </div>
  )
}
const json = { 'Content-Type': 'application/json' }
const fmt = (iso: string) => `${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} ${hhmm(iso)}`

// The caretaker's job, responsibilities, do's and don'ts. Each law is signed
// separately by her (typed full name + the time); the owners see who signed what.
export default function CareJobRules() {
  const [rules, setRules] = useState<Rule[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [canSign, setCanSign] = useState(false)
  const [canObserve, setCanObserve] = useState(false)
  const [general, setGeneral] = useState<Obs[]>([])
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<{ id?: number; section: string; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/caretaker/job', { cache: 'no-store' })
      const d = await r.json()
      if (r.ok && Array.isArray(d.rules)) { setRules(d.rules); setCanEdit(!!d.canEdit); setCanSign(!!d.canSign); setCanObserve(!!d.canObserve); setGeneral(d.general ?? []) }
    } catch { setMsg('Could not load. Try again.') }
  }, [])
  useEffect(() => { void load(); try { setName(localStorage.getItem('care-job-name') ?? '') } catch { /* ignore */ } }, [load])

  async function sign(ids: number[]) {
    if (name.trim().length < 3) { setMsg('Type your full name first.'); return }
    setBusy(true); setMsg('')
    try { localStorage.setItem('care-job-name', name.trim()) } catch { /* ignore */ }
    const r = await fetch('/api/caretaker/job/sign', { method: 'POST', headers: json, body: JSON.stringify({ rule_ids: ids, name }) })
    const d = await r.json().catch(() => ({}))
    setMsg(r.ok ? 'Signed.' : d.error ?? 'Could not sign.')
    setBusy(false); void load()
  }
  async function saveRule() {
    if (!editing) return
    const r = await fetch(editing.id ? `/api/caretaker/job/${editing.id}` : '/api/caretaker/job', { method: editing.id ? 'PUT' : 'POST', headers: json, body: JSON.stringify(editing) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(d.error ?? 'Could not save'); return }
    setEditing(null); void load()
  }
  async function remove(id: number) {
    if (confirm('Remove this rule?')) { await fetch(`/api/caretaker/job/${id}`, { method: 'DELETE' }); void load() }
  }

  const unsigned = rules.filter(r => r.signs.length === 0)
  return (
    <div className="mx-auto max-w-xl space-y-4 px-3 pb-24 pt-3">
      <h1 className="text-lg font-bold text-gray-900">Caretaker: Job &amp; Rules</h1>
      <p className="text-xs text-gray-600">{canSign ? 'Read each rule. Tap "I agree and sign" under it to sign. Your full name and the time are saved.' : 'Each rule is signed separately by the caretaker. Changing a rule asks her to sign it again.'}</p>
      {canSign && (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Type your full name (your signature)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
          <button type="button" disabled={busy || unsigned.length === 0} onClick={() => void sign(unsigned.map(r => r.id))} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">
            {unsigned.length ? `I have read all ${unsigned.length} unsigned rules and agree` : 'All rules signed'}
          </button>
        </div>
      )}
      {!canSign && <p className="text-sm font-semibold text-gray-700">{rules.length - unsigned.length} of {rules.length} rules signed</p>}
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
      {JOB_SECTIONS.map(sec => {
        const list = rules.filter(r => r.section === sec)
        if (!list.length && !canEdit) return null
        return (
          <section key={sec} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-gray-700">{sec === 'Job' ? 'Your job' : sec === 'Responsibility' ? 'Responsibilities' : sec === 'Do' ? "Do's" : "Don'ts"}</h2>
              {canEdit && <button type="button" onClick={() => setEditing({ section: sec, text: '' })} className="text-xs font-semibold text-blue-700">+ Add</button>}
            </div>
            {list.map(r => (
              <div key={r.id} className={`rounded-xl border p-3 ${r.signs.length ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <p className="text-sm text-gray-900">{r.text}</p>
                {r.signs.length > 0
                  ? <p className="mt-1 text-xs font-semibold text-green-700">✓ Signed by {r.signs[r.signs.length - 1].signed_name} · {fmt(r.signs[r.signs.length - 1].signed_at)}</p>
                  : <p className="mt-1 text-xs font-semibold text-gray-400">Not signed yet</p>}
                {canSign && r.signs.length === 0 && (
                  <button type="button" disabled={busy} onClick={() => void sign([r.id])} className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">I agree and sign</button>
                )}
                {canObserve && <ObsBlock ruleId={r.id} list={r.obs ?? []} onChanged={() => void load()} />}
                {canEdit && (
                  <div className="mt-1 flex gap-3">
                    <button type="button" onClick={() => setEditing({ id: r.id, section: r.section, text: r.text })} className="text-xs font-semibold text-blue-700">Edit</button>
                    <button type="button" onClick={() => void remove(r.id)} className="text-xs font-semibold text-red-600">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )
      })}
      {canObserve && (
        <section className="space-y-1">
          <h2 className="text-sm font-bold uppercase text-gray-700">General observations</h2>
          <p className="text-[11px] text-gray-500">Not tied to one rule. Private: the caretaker cannot see any observations.</p>
          <ObsBlock ruleId={null} list={general} onChanged={() => void load()} open />
        </section>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setEditing(null)}>
          <div className="mx-auto w-full max-w-xl space-y-3 rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
            <p className="text-base font-bold">{editing.id ? 'Edit rule' : 'Add rule'}</p>
            <select value={editing.section} onChange={e => setEditing({ ...editing, section: e.target.value })} className="w-full rounded-xl border border-gray-300 p-3 text-sm">
              {JOB_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} rows={4} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
            {editing.id && <p className="text-[11px] text-gray-500">If you change the wording, the caretaker must sign this rule again.</p>}
            <button type="button" disabled={!editing.text.trim()} onClick={() => void saveRule()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
