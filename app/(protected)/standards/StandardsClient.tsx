'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { GREETING_FULL, GREETING_SHORT, GROUP_URL, REGISTER_URL } from './shareText'

type Item = {
  id: number
  station: string
  section: string
  section_note: string | null
  text: string
  how: string | null
  tag: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'once'
  kind: string
  ticked_by: string | null
  ticked_at: string | null
}

const FREQ_LABEL: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', once: 'One-off' }
const STATION_ORDER = ['Shop', 'Grony 1', 'Grony 2', 'Grony 3', 'Grony 4', 'Grony 5', 'Grony 6', 'Grony 7', 'Grony 8']

function matches(item: Item, sel: string) {
  if (sel === 'All') return true
  if (sel === 'Shop') return item.station === 'Shop'
  if (item.station === sel || item.station === 'All stations') return true
  return item.station === 'Grony 1 & 2' && (sel === 'Grony 1' || sel === 'Grony 2')
}

export default function StandardsClient({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [station, setStation] = useState('All')
  const [openOnly, setOpenOnly] = useState(false)
  const [redOnly, setRedOnly] = useState(false)
  const [freq, setFreq] = useState('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)
  const [adding, setAdding] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/standards', { cache: 'no-store' })
      if (!r.ok) throw new Error('Could not load standards.')
      setItems(await r.json())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load standards.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const stations = useMemo(() => {
    const present = new Set(items.map(i => i.station))
    const real = STATION_ORDER.filter(s => s === 'Shop' || items.some(i => matches(i, s)) || present.has(s))
    return ['All', ...real]
  }, [items])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter(i =>
      matches(i, station) &&
      (!openOnly || !i.ticked_at) &&
      (!redOnly || !!i.tag) &&
      (freq === 'all' || i.frequency === freq) &&
      (!needle || i.text.toLowerCase().includes(needle) || (i.how ?? '').toLowerCase().includes(needle) || i.section.toLowerCase().includes(needle)))
  }, [items, station, openOnly, redOnly, freq, q])

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of visible) {
      const key = `${i.station}||${i.section}`
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(i)
    }
    return [...m.entries()]
  }, [visible])

  const done = visible.filter(i => i.ticked_at).length

  async function toggle(item: Item) {
    const ticked = !item.ticked_at
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, ticked_at: ticked ? new Date().toISOString() : null, ticked_by: ticked ? 'you' : null } : i))
    try {
      const r = await fetch('/api/standards/tick', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, ticked }),
      })
      if (!r.ok) throw new Error()
      load()
    } catch {
      setError('That tick did not save. Check your connection and try again.')
      load()
    }
  }

  async function copy(label: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2000) }
    catch { setError('Copy failed. Select the text and copy it by hand.') }
  }

  const title = `${station === 'All' ? 'All stations' : station}${openOnly ? ' - not done yet' : ''}${redOnly ? ' - red markers' : ''}`

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 print:p-0 print:max-w-none">
      <div className="print:hidden flex flex-wrap items-center gap-2 mb-3">
        <a href="/item" className="text-sm text-gray-500 hover:text-gray-900">&larr; Back to app</a>
        <h1 className="text-xl font-bold text-[#14213D] mr-auto ml-2">Standards</h1>
        <button onClick={() => setShareOpen(v => !v)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">Share with customers</button>
        {canEdit && <button onClick={() => setAdding(true)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">+ Add line</button>}
        <button onClick={() => window.print()} className="text-sm px-3 py-1.5 rounded-lg bg-[#E85D04] text-white font-semibold hover:opacity-90">Print this view</button>
      </div>

      {shareOpen && (
        <div className="print:hidden mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-[#14213D]">Share with customers</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['Registration link', REGISTER_URL],
              ['WhatsApp group link', GROUP_URL],
              ['Greeting (short)', GREETING_SHORT],
              ['Greeting (full)', GREETING_FULL],
            ].map(([label, text]) => (
              <button key={label} onClick={() => copy(label, text)}
                className="text-sm px-3 py-1.5 rounded-lg border border-orange-300 bg-white hover:bg-orange-100">
                {copied === label ? 'Copied' : `Copy ${label.toLowerCase()}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">The short greeting ({GREETING_SHORT.length} characters) fits the WhatsApp Business greeting box. Paste it under Business tools, Greeting message.</p>
        </div>
      )}

      <div className="print:hidden sticky top-0 z-10 bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-2 mb-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {stations.map(s => (
            <button key={s} onClick={() => setStation(s)}
              className={`text-sm px-3 py-1 rounded-full border ${station === s ? 'bg-[#14213D] text-white border-[#14213D]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{s}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />Not done yet</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={redOnly} onChange={e => setRedOnly(e.target.checked)} />Red markers only</label>
          <select value={freq} onChange={e => setFreq(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 bg-white">
            <option value="all">Any frequency</option>
            {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="border border-gray-300 rounded-lg px-2 py-1 flex-1 min-w-32" />
          <span className="text-gray-500 tabular-nums">{done} of {visible.length} done</span>
        </div>
      </div>

      {error && <p className="print:hidden mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="hidden print:block mb-2 text-[10px]">
        <b>Grony Multimedia - Standards - {title}</b> - printed {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} - {done} of {visible.length} done
      </div>

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : groups.length === 0 ? (
        <p className="text-sm text-gray-500">{items.length === 0 ? 'No standards have been loaded yet.' : 'Nothing matches these filters.'}</p>
      ) : (
        <div className="md:columns-2 print:columns-4 gap-3 print:gap-2">
          {groups.map(([key, list]) => {
            const [st, sec] = key.split('||')
            return (
              <section key={key} className="break-inside-avoid mb-3 print:mb-1.5 rounded-xl border border-gray-200 bg-white print:rounded-none print:border-gray-400">
                <header className="bg-[#14213D] text-white px-2.5 py-1 rounded-t-xl print:rounded-none text-xs font-semibold flex justify-between gap-2">
                  <span>{sec}</span><span className="font-normal opacity-80 shrink-0">{st}</span>
                </header>
                {list[0].section_note && <p className="px-2.5 pt-1 text-[11px] text-gray-500 print:text-[7px]">{list[0].section_note}</p>}
                <ul className="p-1.5">
                  {list.map(i => (
                    <li key={i.id} className="flex gap-2 py-1 border-b border-gray-100 last:border-0 print:py-0.5">
                      <input type="checkbox" checked={!!i.ticked_at} onChange={() => toggle(i)} className="mt-0.5 h-4 w-4 shrink-0 print:h-2.5 print:w-2.5" aria-label={i.text} />
                      <div className="min-w-0 flex-1 text-sm print:text-[7.5px] leading-snug">
                        <span className={i.ticked_at ? 'text-gray-400 line-through print:no-underline' : ''}>
                          {i.tag && <b className="text-red-700 mr-1">{i.tag}</b>}{i.text}
                        </span>
                        {i.how && <span className="block text-[11px] print:text-[6.5px] text-gray-500 italic">How: {i.how}</span>}
                        <span className="print:hidden block text-[10px] text-gray-400">
                          {FREQ_LABEL[i.frequency]}{i.ticked_at ? ` - ${i.ticked_by} ${new Date(i.ticked_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' })}` : ''}
                        </span>
                      </div>
                      {canEdit && <button onClick={() => setEditing(i)} className="print:hidden text-[11px] text-gray-400 hover:text-gray-800 self-start">Edit</button>}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {editing && <EditModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {adding && <AddModal stations={stations.filter(s => s !== 'All')} sections={[...new Set(items.map(i => i.section))]} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="print:hidden fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg p-4 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white'

function EditModal({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(item.text)
  const [how, setHow] = useState(item.how ?? '')
  const [frequency, setFrequency] = useState(item.frequency)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save(active = true) {
    if (!active && !confirm('Remove this line from the standards?')) return
    setBusy(true); setErr('')
    const r = await fetch(`/api/standards/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, how, frequency, active }) })
    setBusy(false)
    if (r.ok) onSaved(); else setErr((await r.json().catch(() => ({}))).error ?? 'Could not save.')
  }
  return (
    <Modal onClose={onClose}>
      <h2 className="font-bold text-[#14213D]">Edit line</h2>
      <textarea className={inputCls} rows={3} value={text} onChange={e => setText(e.target.value)} />
      <input className={inputCls} placeholder="How: short note (optional)" value={how} onChange={e => setHow(e.target.value)} />
      <select className={inputCls} value={frequency} onChange={e => setFrequency(e.target.value as Item['frequency'])}>
        {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <div className="flex justify-between gap-2">
        <button disabled={busy} onClick={() => save(false)} className="text-sm px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50">Remove</button>
        <div className="flex gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300">Cancel</button>
          <button disabled={busy} onClick={() => save(true)} className="text-sm px-3 py-1.5 rounded-lg bg-[#14213D] text-white font-semibold">Save</button>
        </div>
      </div>
    </Modal>
  )
}

function AddModal({ stations, sections, onClose, onSaved }: { stations: string[]; sections: string[]; onClose: () => void; onSaved: () => void }) {
  const [station, setStation] = useState(stations[0] ?? 'Shop')
  const [section, setSection] = useState(sections[0] ?? '')
  const [text, setText] = useState('')
  const [how, setHow] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    setBusy(true); setErr('')
    const r = await fetch('/api/standards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ station, section, text, how, frequency }) })
    setBusy(false)
    if (r.ok) onSaved(); else setErr((await r.json().catch(() => ({}))).error ?? 'Could not save.')
  }
  return (
    <Modal onClose={onClose}>
      <h2 className="font-bold text-[#14213D]">Add a line</h2>
      <select className={inputCls} value={station} onChange={e => setStation(e.target.value)}>{stations.map(s => <option key={s}>{s}</option>)}</select>
      <input className={inputCls} list="std-sections" placeholder="Section (pick or type a new one)" value={section} onChange={e => setSection(e.target.value)} />
      <datalist id="std-sections">{sections.map(s => <option key={s} value={s} />)}</datalist>
      <textarea className={inputCls} rows={3} placeholder="What must be checked" value={text} onChange={e => setText(e.target.value)} />
      <input className={inputCls} placeholder="How: short note (optional)" value={how} onChange={e => setHow(e.target.value)} />
      <select className={inputCls} value={frequency} onChange={e => setFrequency(e.target.value)}>
        {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {err && <p className="text-sm text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300">Cancel</button>
        <button disabled={busy || !text.trim() || !section.trim()} onClick={save} className="text-sm px-3 py-1.5 rounded-lg bg-[#14213D] text-white font-semibold disabled:opacity-50">Add</button>
      </div>
    </Modal>
  )
}
