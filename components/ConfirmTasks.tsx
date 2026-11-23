'use client'
import { useEffect, useState } from 'react'

type Row = { id: number; title: string; day: string; recorded_by: string; recorded_at: string; note: string | null }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const at = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }

// For a supervisor: the tasks someone ticked that the law says must be confirmed. Confirm it was really done, or say what was not done and it goes back to waiting.
export default function ConfirmTasks({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [no, setNo] = useState<number | null>(null)
  const [why, setWhy] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => fetch('/api/daily-checks/confirm', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setRows(d?.rows ?? [])).catch(() => setRows([]))
  useEffect(() => { void load() }, [])
  async function send(id: number, ok: boolean) {
    setBusy(true); setErr('')
    const r = await fetch('/api/daily-checks/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ok, note: why }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return }
    setNo(null); setWhy(''); await load(); onChange?.()
  }
  if (rows === null) return <p className="text-sm text-gray-400">Loading…</p>
  if (rows.length === 0) return <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">Nothing is waiting for you to confirm.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {rows.map(r => (
        <div key={r.id} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-[12px] font-bold text-gray-500">{cap(r.recorded_by)} ticked it at {at(r.recorded_at)} on {r.day}</p>
          <p className="text-[14px] font-semibold leading-snug text-gray-900">{r.title}</p>
          {r.note && <p className="text-[13px] text-gray-700">Note: {r.note}</p>}
          {no === r.id ? (
            <div className="mt-2 space-y-2">
              <input autoFocus value={why} onChange={e => setWhy(e.target.value)} placeholder="What was not done?" className="w-full rounded-xl border border-gray-300 p-3 text-[16px]" />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => void send(r.id, false)} className="min-h-[44px] flex-1 rounded-xl bg-red-600 text-[15px] font-bold text-white disabled:opacity-40">Send it back</button>
                <button type="button" onClick={() => { setNo(null); setWhy('') }} className="min-h-[44px] flex-1 rounded-xl bg-gray-100 text-[15px] font-bold text-gray-700">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void send(r.id, true)} className="min-h-[44px] flex-1 rounded-xl bg-green-600 text-[15px] font-bold text-white disabled:opacity-40">Yes, it was done</button>
              <button type="button" disabled={busy} onClick={() => { setNo(r.id); setWhy('') }} className="min-h-[44px] flex-1 rounded-xl bg-gray-600 text-[15px] font-bold text-white disabled:opacity-40">Not done</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
