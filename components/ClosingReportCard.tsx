'use client'
import { useEffect, useState } from 'react'
import CloserQuestionnaire, { type ClosingAnswers } from '@/components/CloserQuestionnaire'

// The closing report (a row among the day's tasks), answered from the Daily Checklist (it used to block the last person's clock-out). Shown at the top of the Daily Checklist whenever someone is
// clocked in (due from 5pm, can be answered early), and as "done" once it has been answered. Never covers the screen: it is a card on the page, and the questions open only when tapped.
export default function ClosingReportCard() {
  const [st, setSt] = useState<{ done: boolean; by: string | null; present: string[] } | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const load = () => fetch('/api/closing-report', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => d && setSt(d)).catch(() => {})
  useEffect(() => { void load() }, [])
  useEffect(() => { if (new URLSearchParams(window.location.search).get('closing') && st && !st.done) setOpen(true) }, [st])
  if (!st || (!st.done && st.present.length === 0)) return null
  const early = new Date().getUTCHours() < 17
  async function submit(a: ClosingAnswers) {
    setSaving(true); setErr('')
    const r = await fetch('/api/closing-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closing_report: a }) })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setErr(d.error ?? 'Could not save. Try again.'); return }
    setOpen(false); void load()
  }
  return (<>
    <div className={`rounded-lg border px-2 py-1 ${st.done ? 'border-green-300 bg-green-50' : early ? 'border-gray-200 bg-gray-50' : 'border-amber-300 bg-amber-50'}`}>
      {st.done
        ? <p className="text-[11px] font-semibold text-green-800">🌙 Closing report done{st.by ? ` by ${st.by.charAt(0).toUpperCase() + st.by.slice(1)}` : ''}.</p>
        : <div className="flex items-center gap-2"><span className="text-lg leading-none">🌙</span><span className="shrink-0 text-[10px] font-bold text-gray-500">17:00</span><span className="flex-1 text-[11px] font-semibold leading-tight text-gray-900">Closing report{early ? ' (can be answered early)' : ''}</span>
            <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Answer</button></div>}
      {err && <p className="mt-1 text-xs font-bold text-red-700">{err}</p>}
    </div>
    {open && <CloserQuestionnaire presentStaff={st.present} saving={saving} onSubmit={a => void submit(a)} onCancel={() => setOpen(false)} />}
  </>)
}
