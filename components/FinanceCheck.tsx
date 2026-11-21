'use client'
import { useEffect, useState } from 'react'

type Kind = 'expenses' | 'bills'
type Step = 'ask' | 'outstanding'

// The manager's login question: "have you recorded all expenses on the system?" (every login) and the same for bills (Tuesday and Friday).
// Yes ends it. No offers to record the outstanding ones now (with the link) or to skip. Skipping is offered too. Every answer is recorded.
const WORDS: Record<Kind, { many: string; page: string; link: string }> = {
  expenses: { many: 'expenses', page: 'Expenses', link: '/item?mode=expenses' },
  bills: { many: 'bills', page: 'Bills', link: '/item?mode=bills' },
}
const doneKey = (k: Kind) => `financeCheck:${k}`
const seen = (k: Kind) => { try { return !!sessionStorage.getItem(doneKey(k)) } catch { return false } }
const mark = (k: Kind) => { try { sessionStorage.setItem(doneKey(k), '1') } catch { /* private window */ } }

export default function FinanceCheck() {
  const [queue, setQueue] = useState<Kind[]>([])
  const [step, setStep] = useState<Step>('ask')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const p = window.location.pathname
    if (p.startsWith('/login') || p.startsWith('/start-of-day')) return
    // A little after the login, so it does not fight with the other login prompts.
    const t = setTimeout(() => {
      fetch('/api/finance-checks', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { const due = (Array.isArray(d?.due) ? d.due : []) as Kind[]; setQueue(due.filter(k => !seen(k))) })
        .catch(() => {})
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  const kind = queue[0]
  if (!kind) return null
  const w = WORDS[kind]

  async function send(answer: 'yes' | 'no' | 'skip', action?: 'record_now' | 'skip') {
    setBusy(true)
    await fetch('/api/finance-checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, answer, action }) }).catch(() => {})
    mark(kind)
    setBusy(false)
    setStep('ask')
    setQueue(q => q.slice(1))
    if (action === 'record_now') window.location.href = w.link
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 p-3 sm:items-center print:hidden">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-indigo-700">{w.page} check</p>
        {step === 'ask' ? (<>
          <p className="text-base font-bold text-gray-900">Have you recorded all {w.many} on the system?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void send('yes')} className="rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-50">Yes</button>
            <button type="button" disabled={busy} onClick={() => setStep('outstanding')} className="rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">No</button>
          </div>
          <button type="button" disabled={busy} onClick={() => void send('skip', 'skip')} className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Skip for now</button>
        </>) : (<>
          <p className="text-base font-bold text-gray-900">Do you want to record the outstanding {w.many} now?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void send('no', 'record_now')} className="rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">Record now</button>
            <button type="button" disabled={busy} onClick={() => void send('no', 'skip')} className="rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50">Skip</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
