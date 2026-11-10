'use client'
import { useEffect, useState } from 'react'
import WithMic from '@/components/WithMic'

type Sale = { time: string; item: string; qty: number; price: number; staff: string; undone: boolean }
type Review = { day: string; status: string; staff: string[]; windows: { from: string; to: string }[]; sales: Sale[]; reviewed_by?: string; sales_ok?: boolean; laws_ok?: boolean; note?: string }
type Law = { id: number; code: string | null; title: string | null; text: string; violations: string }
type V = { text: string; points: number }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

export default function CctvClient() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [laws, setLaws] = useState<Law[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const load = () => fetch('/api/cctv-review', { cache: 'no-store' }).then(r => r.json()).then(d => { setReviews(d.reviews ?? []); setOpen(o => o ?? (d.reviews ?? []).find((x: Review) => x.status === 'pending')?.day ?? null) }).catch(() => {})
  useEffect(() => { void load(); fetch('/api/page-laws').then(r => r.json()).then(d => setLaws(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  const pending = reviews.filter(r => r.status === 'pending')
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3">
      <h1 className="text-xl font-extrabold text-[#14213D]">CCTV review</h1>
      <p className="text-sm text-gray-700">Days when staff were at work and Joe had not clocked in. Watch the CCTV for the times shown. Confirm that every sale was entered as expected and every law was kept. If not, log a violation or send a question to the staff member.</p>
      {!reviews.length && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">Nothing to review.</p>}
      {pending.length > 0 && <p className="rounded-xl bg-red-50 p-2 text-sm font-bold text-red-700">{pending.length} day{pending.length === 1 ? '' : 's'} waiting for your review.</p>}
      {reviews.map(r => <Day key={r.day} r={r} laws={laws} open={open === r.day} toggle={() => setOpen(open === r.day ? null : r.day)} done={load} />)}
    </div>
  )
}

function Day({ r, laws, open, toggle, done }: { r: Review; laws: Law[]; open: boolean; toggle: () => void; done: () => void }) {
  const [sales, setSales] = useState<boolean | null>(null)
  const [lawsOk, setLawsOk] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [who, setWho] = useState(r.staff[0] ?? '')
  const [lawId, setLawId] = useState('')
  const [vi, setVi] = useState(0)
  const [q, setQ] = useState('')
  const lawList = laws.filter(l => { try { return (JSON.parse(l.violations) as V[]).some(v => v.points > 0) } catch { return false } })
  const picked = lawList.find(l => String(l.id) === lawId)
  const vs: V[] = picked ? (JSON.parse(picked.violations) as V[]).filter(v => v.points > 0) : []
  async function call(url: string, body: object, ok: string) {
    setMsg('')
    const res = await fetch(url, { method: url.includes('penalties') ? 'POST' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? ok : (d.error ?? 'Could not save.'))
    return res.ok
  }
  const pend = r.status === 'pending'
  return (
    <div className={`rounded-2xl border-2 ${pend ? 'border-red-300 bg-white' : 'border-gray-200 bg-gray-50'}`}>
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between p-3 text-left">
        <span className="font-bold text-[#14213D]">{r.day} <span className="font-normal text-gray-600">— {r.staff.map(cap).join(', ')} at work, Joe not clocked in</span></span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pend ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{pend ? 'To review' : 'Done'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t p-3">
          <div><p className="text-xs font-bold uppercase text-gray-500">Watch the CCTV for</p>{r.windows.map((w, i) => <p key={i} className="text-base font-bold text-gray-900">{w.from} to {w.to}</p>)}</div>
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">Sales entered in those times ({r.sales.length})</p>
            {r.sales.length ? <ul className="max-h-48 overflow-y-auto text-sm">{r.sales.map((s, i) => <li key={i} className={s.undone ? 'text-gray-400 line-through' : ''}>{s.time} · {cap(s.staff)} · {s.qty}× {s.item} · GH₵{s.price}</li>)}</ul> : <p className="text-sm text-red-700">No sale was entered in these times. Check the CCTV for any sale made.</p>}
          </div>
          {pend ? (<>
            <Choice label="Were all sales in these times entered as expected?" v={sales} set={setSales} />
            <Choice label="Were all company laws observed as expected?" v={lawsOk} set={setLawsOk} />
            {(sales === false || lawsOk === false) && (
              <div className="space-y-2 rounded-xl bg-amber-50 p-2">
                <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What was wrong? (time, what you saw)" className="w-full rounded-lg border p-2 text-sm" rows={2} /></WithMic>
                <p className="text-xs font-bold text-gray-700">Log a violation</p>
                <select value={who} onChange={e => setWho(e.target.value)} className="w-full rounded-lg border p-2 text-sm">{r.staff.map(s => <option key={s} value={s}>{cap(s)}</option>)}</select>
                <select value={lawId} onChange={e => { setLawId(e.target.value); setVi(0) }} className="w-full rounded-lg border p-2 text-sm"><option value="">Choose the law…</option>{lawList.map(l => <option key={l.id} value={l.id}>{l.code} {l.title ?? l.text.slice(0, 50)}</option>)}</select>
                {picked && <select value={vi} onChange={e => setVi(Number(e.target.value))} className="w-full rounded-lg border p-2 text-sm">{vs.map((v, i) => <option key={i} value={i}>{v.text} ({v.points} pt)</option>)}</select>}
                <button type="button" disabled={!picked || note.trim().length < 4} onClick={async () => { await call('/api/penalties', { staffs: [who], law_id: picked!.id, violation_index: vi, note: note + ` (CCTV review of ${r.day})`, day: r.day }, 'Violation logged.') }} className="w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-40">Log violation against {cap(who)}</button>
                <p className="text-xs font-bold text-gray-700">Or send a question</p>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Question for ${cap(who)}`} className="w-full rounded-lg border p-2 text-sm" />
                <button type="button" disabled={q.trim().length < 4} onClick={async () => { if (await call('/api/cctv-review', { action: 'query', day: r.day, staff: who, about: q }, `Question sent to ${cap(who)}.`)) setQ('') }} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send question to {cap(who)}</button>
              </div>)}
            {msg && <p className="text-sm font-bold text-gray-800">{msg}</p>}
            <button type="button" disabled={sales === null || lawsOk === null} onClick={async () => { if (await call('/api/cctv-review', { action: 'complete', day: r.day, sales_ok: sales, laws_ok: lawsOk, note }, 'Review recorded.')) done() }} className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">I have watched the CCTV: complete this review</button>
          </>) : <p className="text-sm text-gray-700">Reviewed by {cap(r.reviewed_by ?? '')}: sales {r.sales_ok ? 'as expected' : 'not as expected'}, laws {r.laws_ok ? 'observed' : 'not observed'}.{r.note ? ` ${r.note}` : ''}</p>}
        </div>)}
    </div>
  )
}

function Choice({ label, v, set }: { label: string; v: boolean | null; set: (b: boolean) => void }) {
  return (
    <div><p className="text-sm font-bold text-gray-900">{label}</p>
      <div className="mt-1 flex gap-2">
        <button type="button" onClick={() => set(true)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${v === true ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Yes, all as expected</button>
        <button type="button" onClick={() => set(false)} className={`flex-1 rounded-xl py-2 text-sm font-bold ${v === false ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>No, something was wrong</button>
      </div>
    </div>
  )
}
