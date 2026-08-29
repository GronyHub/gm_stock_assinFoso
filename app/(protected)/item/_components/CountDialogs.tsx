'use client'
import { useState } from 'react'

// LossDialog and PairingDialog used to live only inside CountsTab.tsx --
// pulled out here so Live Sale's own Count mode (now inlined directly into
// item/page.tsx's ItemHubPageInner) can reuse them verbatim too, without
// either duplicating ~150 lines of dialog code or pulling CountsTab's whole
// module (default export included) into item/page.tsx's bundle just for
// these two.

export type LossExtra = { loss_reason: string; manager_response: string | null }
export type LossPrompt = { d: any; retry: (extra: LossExtra) => void }

// Common reasons a physical count comes in under what the system expects --
// picking one is faster and more consistent than typing a reason from
// scratch every time. 'other' keeps the free-text box for anything that
// doesn't fit, same "preset dropdown + Other…" pattern as
// COUNT_EXCLUDED_REASONS in lib/countRules.ts.
export const LOSS_REASONS = [
  { key: 'theft', label: 'Theft / stolen' },
  { key: 'damaged', label: 'Damaged or broken' },
  { key: 'wastage', label: 'Wastage during printing/production' },
  { key: 'expired', label: 'Expired or spoiled' },
  { key: 'given_away', label: 'Given away / sample' },
  { key: 'staff_use', label: 'Used internally by staff' },
  { key: 'wrong_sale_qty', label: 'A sale was recorded with the wrong quantity' },
  { key: 'misplaced', label: 'Misplaced / moved without a record' },
  { key: 'miscount', label: 'An earlier count was wrong' },
  { key: 'other', label: 'Other' },
] as const

// A count that reveals a loss is not saved silently. This dialog first offers
// the tools that usually explain a "loss" -- a mistyped sale, a missing bill,
// an earlier miscount -- so records can be fixed and the item recounted.
// Only if it's a real loss does the counter give a reason and (unless they
// are the manager) enter what the manager said.
export function LossDialog({ prompt: lp, onClose, onFixRecords }: {
  prompt: LossPrompt
  onClose: () => void
  onFixRecords?: (view: 'sales' | 'bills' | 'counts') => void
}) {
  const [reasonKey, setReasonKey] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [mgr, setMgr] = useState('')
  const [err, setErr] = useState('')
  const d = lp.d

  const finalReason = reasonKey === 'other'
    ? customReason.trim()
    : (LOSS_REASONS.find(r => r.key === reasonKey)?.label ?? '')

  function confirmLoss() {
    if (!finalReason) { setErr('A reason for the loss is required.'); return }
    if (!d.is_manager && !mgr.trim()) { setErr("Inform the manager and enter what the manager said."); return }
    lp.retry({ loss_reason: finalReason, manager_response: d.is_manager ? null : mgr.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <p className="text-sm font-bold text-red-700">⚠ Loss detected — count not saved yet</p>
          <p className="text-xs text-red-800 mt-0.5">
            Expected <b>{d.expected}</b>, counted <b>{d.counted}</b> → loss of <b>-{d.loss}</b>.
          </p>
        </div>

        {onFixRecords && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">
              First check whether a record mistake caused this — fix it, then count again:
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => { onClose(); onFixRecords('sales') }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg py-2 transition">
                📄 Sales
              </button>
              <button onClick={() => { onClose(); onFixRecords('bills') }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg py-2 transition">
                🧾 Bills
              </button>
              <button onClick={() => { onClose(); onFixRecords('counts') }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg py-2 transition">
                🔢 Counts
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              A sale entered with the wrong quantity, a bill never recorded, or an earlier miscount all show up as a "loss".
            </p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-700">Or confirm it is a real loss:</p>
          <select value={reasonKey} onChange={e => setReasonKey(e.target.value)}
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300">
            <option value="">Why did this loss happen? (required)</option>
            {LOSS_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {reasonKey === 'other' && (
            <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} rows={2}
              placeholder="Describe the reason (required)"
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300" />
          )}
          {!d.is_manager && (
            <textarea value={mgr} onChange={e => setMgr(e.target.value)} rows={2}
              placeholder="Inform the manager now — what did the manager say? (required)"
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300" />
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={confirmLoss}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl py-2.5 transition">
              Save as Loss
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export type GainExtra = { loss_reason: string }
export type GainPrompt = { d: any; retry: (extra: GainExtra) => void }

const GAIN_REASONS = [
  { key: 'received_unreported', label: 'Stock received that wasn\'t recorded in a bill' },
  { key: 'miscount_earlier', label: 'An earlier count was wrong' },
  { key: 'found_stock', label: 'Found stock that was misplaced or lost' },
  { key: 'inventory_adjustment', label: 'Inventory adjustment from management' },
  { key: 'other', label: 'Other' },
] as const

export function GainDialog({ prompt: gp, onClose }: {
  prompt: GainPrompt
  onClose: () => void
}) {
  const [reasonKey, setReasonKey] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [err, setErr] = useState('')
  const d = gp.d

  const finalReason = reasonKey === 'other'
    ? customReason.trim()
    : (GAIN_REASONS.find(r => r.key === reasonKey)?.label ?? '')

  function confirmGain() {
    if (!finalReason) { setErr('A reason for the gain is required.'); return }
    gp.retry({ loss_reason: finalReason })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <p className="text-sm font-bold text-blue-700">📊 Gain detected — count not saved yet</p>
          <p className="text-xs text-blue-800 mt-0.5">
            Expected <b>{d.expected}</b>, counted <b>{d.counted}</b> → gain of <b>+{d.gain}</b>.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-700">Please investigate and confirm:</p>
          <select value={reasonKey} onChange={e => setReasonKey(e.target.value)}
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">What caused this gain? (required)</option>
            {GAIN_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {reasonKey === 'other' && (
            <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} rows={2}
              placeholder="Describe the reason (required)"
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={confirmGain}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl py-2.5 transition">
              Save as Gain
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export type PackRef = { id: number; name: string }
export type PairingPrompt = { itemName: string; packs: PackRef[]; retry: () => void }

// A blocking pack-chain (A4 Brown Envelope, A4 Lamination, 4x6): the singles
// count can't be saved until one of its packs is also counted today -- a
// pack can otherwise sit open through an entire USED/PACK overrun with
// nobody noticing. Lets the counter enter the pack's qty right here instead
// of navigating away and coming back.
export function PairingDialog({ prompt: pp, onClose }: { prompt: PairingPrompt; onClose: () => void }) {
  const [packId, setPackId] = useState<number>(pp.packs[0].id)
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function saveBoth() {
    if (qty === '') { setErr('Enter the pack count.'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: packId, qty: Number(qty), notes: '' }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setErr(d?.error ?? 'Could not save the pack count.')
      return
    }
    onClose()
    pp.retry()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <p className="text-sm font-bold text-amber-800">Count the pack too</p>
          <p className="text-xs text-amber-900 mt-0.5">
            &quot;{pp.itemName}&quot; is paired with {pp.packs.map(p => p.name).join(' / ')} — count it too before this can be saved.
          </p>
        </div>
        {pp.packs.length > 1 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Which pack?</p>
            <select value={packId} onChange={e => setPackId(Number(e.target.value))}
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none">
              {pp.packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-1">Pack qty counted</p>
          <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)}
            inputMode="decimal" autoFocus
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button onClick={saveBoth} disabled={saving}
            className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? 'Saving…' : 'Save Both'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
