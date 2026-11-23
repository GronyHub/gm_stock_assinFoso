'use client'
import { useState } from 'react'

// Manage tile: the owner prompts Joe to check what is waiting for him (clock times to approve, CCTV reviews). It used to sit above the Waiting tiles.
export default function PromptJoe() {
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState(false)
  async function nudge() {
    setBusy(true)
    const r = await fetch('/api/clock/nudge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    setSent(r.ok ? (d?.sent ? 'Joe has been prompted.' : 'Nothing is waiting for Joe.') : (d?.error ?? 'Only the owner can prompt Joe.'))
  }
  return (
    <div className="mx-auto max-w-md space-y-3 p-4">
      <p className="text-sm text-gray-700">Sends Joe a prompt to check what is waiting for him: clock times to approve and CCTV reviews. Nothing is sent when nothing is waiting.</p>
      <button type="button" disabled={busy} onClick={() => void nudge()} className="w-full rounded-xl bg-[#14213D] py-3 text-base font-bold text-white disabled:opacity-40">🔔 Prompt Joe to check</button>
      {sent && <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">{sent}</p>}
    </div>
  )
}
