'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import CustomerBox from './CustomerBox'

export type SaleTap = {
  id: number; item_name: string; price: number | string; quantity: number; tapped_at: string; undone: boolean
  customer_id_code?: string | null; customer_name?: string | null; customer_phone?: string | null
  buyer_id?: number | null; buyer_name?: string | null; buyer_phone?: string | null
  invoice_id?: number | null; invoice_number?: string | null
}
const json = { 'Content-Type': 'application/json' }
const money = (n: number) => `₵${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10)
const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Sales Log: tapping a customer's name opens that customer's day: everything they bought that day,
// with a receipt for it (issue one, or print / WhatsApp the one already issued), and all their jobs.
export default function TapCustomerSheet({ tapId, allTaps, onClose, onChanged, onRegister }: {
  tapId: number; allTaps: SaleTap[]; onClose: () => void; onChanged: () => void
  onRegister: (phone: string, done: (code: string) => void) => void
}) {
  const tap = allTaps.find(t => t.id === tapId)
  const code = tap?.customer_id_code ?? null
  const phone = tap?.customer_phone ?? tap?.buyer_phone ?? null
  const name = tap?.customer_name ?? tap?.buyer_name ?? null
  const [showAll, setShowAll] = useState(false)
  const [change, setChange] = useState(false)
  const [val, setVal] = useState('')
  const typedName = useRef('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [labelVal, setLabelVal] = useState('')
  // The customer's numbers (main + extras): lets the message go to the right one.
  const [numbers, setNumbers] = useState<{ phone: string; label: string }[]>([])
  const [sendTo, setSendTo] = useState('')
  useEffect(() => {
    if (!code) { setNumbers([]); return }
    fetch(`/api/customers/phones?code=${code}`).then(r => r.json()).then(d => {
      const list: { phone: string; label: string }[] = []
      if (d?.main) list.push({ phone: d.main, label: 'Main' })
      for (const e of d?.extras ?? []) list.push({ phone: e.phone, label: e.label || 'Other' })
      setNumbers(list); setSendTo('')
    }).catch(() => setNumbers([]))
  }, [code])

  const same = (t: SaleTap) => !t.undone && (code ? t.customer_id_code === code : !!phone && (t.buyer_phone ?? t.customer_phone) === phone)
  const mine = useMemo(() => allTaps.filter(same).sort((a, b) => a.tapped_at.localeCompare(b.tapped_at)), [allTaps, code, phone]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!tap) return null
  const curTap: SaleTap = tap
  // A description only (no GM number, no phone): the sale names who did the work.
  const isLabel = !code && !phone && !!name
  const day = dayOf(curTap.tapped_at)
  const dayTaps = mine.filter(t => dayOf(t.tapped_at) === day)
  const dayTotal = dayTaps.reduce((s, t) => s + Number(t.price) * t.quantity, 0)
  const open = dayTaps.filter(t => !t.invoice_id)
  const receipts = [...new Map(dayTaps.filter(t => t.invoice_id).map(t => [t.invoice_id!, t.invoice_number ?? ''])).entries()]
  const allTotal = mine.reduce((s, t) => s + Number(t.price) * t.quantity, 0)

  async function issue() {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/sales/live-receipt', { method: 'POST', headers: json, body: JSON.stringify({ tapIds: open.map(t => t.id) }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Could not issue the receipt')
      setMsg(`Receipt ${d.invoiceNumber} issued.`)
      onChanged()
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }
  async function receiptLinks(invoiceId: number, what: 'print' | 'whatsapp') {
    const w = window.open('', '_blank')
    try {
      const r = await fetch(`/api/sales/live-receipt?invoiceId=${invoiceId}${sendTo ? `&to=${sendTo}` : ''}`)
      const d = await r.json()
      const url = what === 'print' ? d.printUrl : d.whatsappUrl
      if (!r.ok || !url) throw new Error(d.error ?? 'No phone number for this customer yet.')
      if (w) w.location.href = url; else window.location.href = url
    } catch (e) { w?.close(); setMsg((e as Error).message) }
  }
  async function attach() {
    setBusy(true); setMsg('')
    try {
      if (labelVal) {
        const r = await fetch(`/api/sales/live-taps/${curTap.id}/customer`, { method: 'POST', headers: json, body: JSON.stringify({ label: labelVal }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'Could not save')
        setMsg(`Labelled: ${labelVal}`); setChange(false); setLabelVal(''); onChanged()
        setBusy(false); return
      }
      const isPhone = /^0\d{9}$/.test(val)
      // Every sale of this customer on this day takes the customer, so one receipt can cover them all.
      // A label becoming a real customer moves every sale that carries the same label.
      const ids = (isLabel ? allTaps.filter(t => !t.undone && !t.customer_id_code && !(t.buyer_phone ?? t.customer_phone) && (t.buyer_name ?? t.customer_name) === name).map(t => t.id)
        : (dayTaps.length ? dayTaps : [curTap]).map(t => t.id))
      let last: { customer_name: string; customer_id_code: string } | null = null
      for (const id of ids) {
        const r = await fetch(`/api/sales/live-taps/${id}/customer`, { method: 'POST', headers: json, body: JSON.stringify(isPhone ? { phone: val, name: typedName.current } : { code: `GM${val}` }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'Could not save')
        last = d
      }
      setMsg(`Saved: ${last?.customer_name} (${last?.customer_id_code})`)
      setChange(false)
      onChanged()
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[88vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-base font-bold text-gray-900">{name ?? code ?? phone ?? 'No customer yet'}</p>
          <p className="text-xs text-gray-500">{[code, phone].filter(Boolean).join(' · ')}</p>
        </div>

        {isLabel && <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">This is only a label to show who did the work. It is not a customer, so no message or receipt goes with it.</p>}
        {mine.length > 0 && (
          <>
            <div className="rounded-xl bg-green-50 p-2.5">
              <p className="text-xs font-bold uppercase text-green-800">{dayLabel(day)} · {dayTaps.length} item{dayTaps.length === 1 ? '' : 's'} · {money(dayTotal)}</p>
              {dayTaps.map(t => (
                <p key={t.id} className="mt-0.5 flex justify-between gap-2 text-xs text-gray-800">
                  <span className="min-w-0 truncate">{t.quantity} × {t.item_name}{t.invoice_number ? ` · ${t.invoice_number}` : ''}</span>
                  <span className="shrink-0 font-semibold">{money(Number(t.price) * t.quantity)}</span>
                </p>
              ))}
            </div>
            {code && open.length > 0 && (
              <button type="button" disabled={busy} onClick={() => void issue()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">
                Issue receipt for {open.length === dayTaps.length ? 'the day' : 'the remaining'} ({open.length} item{open.length === 1 ? '' : 's'} · {money(open.reduce((s, t) => s + Number(t.price) * t.quantity, 0))})
              </button>
            )}
            {!code && <p className="text-xs text-amber-700">Save this customer first (below) so a receipt can be issued.</p>}
            {numbers.length > 1 && (
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                Send WhatsApp to
                <select value={sendTo} onChange={e => setSendTo(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs">
                  <option value="">Main number</option>
                  {numbers.slice(1).map(n => <option key={n.phone} value={n.phone}>{n.label} · {n.phone}</option>)}
                </select>
              </label>
            )}
            {receipts.map(([invoiceId, number]) => (
              <div key={invoiceId} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
                <p className="flex-1 text-sm font-bold text-gray-900">{number || 'Receipt'}</p>
                <button type="button" onClick={() => void receiptLinks(invoiceId, 'print')} className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-bold text-white">Print</button>
                <button type="button" onClick={() => void receiptLinks(invoiceId, 'whatsapp')} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">WhatsApp</button>
              </div>
            ))}
            <button type="button" onClick={() => setShowAll(v => !v)} className="text-sm font-semibold text-blue-700">
              {showAll ? 'Hide' : 'Show'} all jobs by this customer ({mine.length} · {money(allTotal)})
            </button>
            {showAll && (
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
                {[...mine].reverse().map(t => (
                  <p key={t.id} className="flex justify-between gap-2 text-xs text-gray-800">
                    <span className="min-w-0 truncate"><span className="text-gray-400">{dayLabel(dayOf(t.tapped_at))}</span> · {t.quantity} × {t.item_name}</span>
                    <span className="shrink-0 font-semibold">{money(Number(t.price) * t.quantity)}</span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}

        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <button type="button" onClick={() => setChange(v => !v)} className="text-sm font-semibold text-blue-700">
            {change ? 'Hide' : isLabel ? 'Save as a customer (moves every sale labelled this)' : code || phone ? 'Change customer' : 'Add the customer'}
          </button>
          {change && (
            <>
              <div className="rounded-lg border border-gray-300 px-2 py-2">
                <CustomerBox value={val} onChange={setVal} onName={n => { typedName.current = n }} onRegister={onRegister}
                  label={labelVal} onLabel={l => setLabelVal(l ?? '')}
                  placeholder="GM / phone / name" className="w-full text-sm font-semibold text-gray-900 outline-none" />
              </div>
              <button type="button" disabled={busy || (!val && !labelVal)} onClick={() => void attach()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">{labelVal ? 'Save label on this sale' : "Save customer on this day's sales"}</button>
            </>
          )}
        </div>
        {msg && <p className="text-sm font-semibold text-gray-700">{msg}</p>}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}
