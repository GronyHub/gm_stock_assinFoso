'use client'
import { useEffect, useState } from 'react'
import TaskTile, { type TileDensity } from '@/components/TaskTile'
import CloserQuestionnaire, { type ClosingAnswers } from '@/components/CloserQuestionnaire'

// The closing report (a row among the day's tasks), answered from the Daily Checklist (it used to block the last person's clock-out). Shown at the top of the Daily Checklist whenever someone is
// clocked in (due from 5pm, can be answered early), and as "done" once it has been answered. Never covers the screen: it is a card on the page, and the questions open only when tapped.
export default function ClosingReportCard({ density = 'compact' }: { density?: TileDensity }) {
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
    <TaskTile density={density} icon="🌙" time="17:00" title="Closing report" detail={st.done ? `Answered${st.by ? ` by ${st.by.charAt(0).toUpperCase() + st.by.slice(1)}` : ''}.` : early ? 'Due from 5pm; it can be answered early.' : 'Not answered yet today.'}
      who={st.done && st.by ? st.by.charAt(0).toUpperCase() + st.by.slice(1) : 'Closer'} category="Staff management" type="Recurring task" mark={st.done ? 'done' : undefined}
      tone={st.done ? 'border-green-400 bg-green-50' : early ? 'border-gray-200 bg-gray-50' : 'border-amber-300 bg-amber-50'} onClick={st.done ? undefined : () => setOpen(true)} />
    {err && <p className="col-span-full text-xs font-bold text-red-700">{err}</p>}
    {open && <CloserQuestionnaire presentStaff={st.present} saving={saving} onSubmit={a => void submit(a)} onCancel={() => setOpen(false)} />}
  </>)
}
