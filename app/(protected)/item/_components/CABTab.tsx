'use client'
import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import { CATEGORIES, CAT_ICON, CAT_COLOR, CHILDREN_SUBCATEGORIES, type PersonalEntry } from './PersonalTab'
import AssignWidget from './AssignWidget'
import DynamicTasksSection from './DynamicTasksSection'

type Row = {
  entry_date: string
  cash_counted: number | null
  grony_personal_cash_in: number | null
  debtors_cash_in: number | null
  bills: number | null
  expenses: number | null
  grony_personal_expenses: number | null
  daily_net: number | null
  running_cash_at_bank: number | null
  cab_bank: number | null
  cab_momo: number | null
  cab_physical: number | null
  cab_total: number | null
  deficit: number | null
}

type WeekSummary = {
  weekStart: string; weekEnd: string
  net: number; runningEnd: number | null
  confirmed: boolean; cabTotal: number | null; deficit: number | null
}

const fmt  = (n: any) => n == null ? '—' : `₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const fmtn = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-GH', { minimumFractionDigits: 0 })
const nz   = (v: any) => (v == null || Number(v) === 0) ? '' : fmtn(v)

// Postgres DATE_TRUNC('week', ...) (same rule the uncheckedCab flag query
// uses) treats weeks as ISO -- Monday through Sunday. Grouping client-side
// with the same rule keeps this table's weeks lined up with that flag.
function isoWeekStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const TONE_CLS = {
  blue:   'bg-blue-50 text-blue-700',
  green:  'bg-green-50 text-green-600',
  red:    'bg-red-50 text-red-600',
} as const

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: keyof typeof TONE_CLS }) {
  return (
    <div className={`rounded-xl p-3 ${TONE_CLS[tone]}`}>
      <p className="text-[10px] font-semibold opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function CABTab({ openConfirmSignal }: { openConfirmSignal?: number } = {}) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const isOwnerOrJoe = role === 'owner' || username === 'joe'
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [showWeekly, setShowWeekly] = useState(false)
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(false)
  const [confirmedColsOnly, setConfirmedColsOnly] = useState(false)
  const [hideBankMomoPhysical, setHideBankMomoPhysical] = useState(false)
  const [gpOutOnly, setGpOutOnly] = useState(false)
  const [personalDirection, setPersonalDirection] = useState<'out' | 'in'>('out')
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [byCategory, setByCategory] = useState(false)
  const [showConfirmForm, setShowConfirmForm] = useState(false)
  const [confirmDate, setConfirmDate] = useState('')
  const [confirmBank, setConfirmBank] = useState('')
  const [confirmMomo, setConfirmMomo] = useState('')
  const [confirmPhysical, setConfirmPhysical] = useState('')
  const [confirmSaving, setConfirmSaving] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [personalEntries, setPersonalEntries] = useState<PersonalEntry[]>([])
  const [showAddPersonal, setShowAddPersonal] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addAmt, setAddAmt] = useState('')
  const [addDir, setAddDir] = useState<'out' | 'in'>('out')
  const [addCat, setAddCat] = useState('Other')
  const [addCatCustom, setAddCatCustom] = useState(false)
  const [addSubcat, setAddSubcat] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editEntryId, setEditEntryId] = useState<number | null>(null)
  const [editEntryCat, setEditEntryCat] = useState('')
  const [editEntryCatCustom, setEditEntryCatCustom] = useState(false)
  const [editEntrySubcat, setEditEntrySubcat] = useState('')
  const [deleteEntryConfirmId, setDeleteEntryConfirmId] = useState<number | null>(null)
  const [openEntryRow, setOpenEntryRow] = useState<number | null>(null)
  const [splitEntryId, setSplitEntryId] = useState<number | null>(null)
  const [splitParts, setSplitParts] = useState<{ description: string; amount: string }[]>([])
  const [splitSaving, setSplitSaving] = useState(false)

  function loadRows() {
    fetch('/api/cash-at-bank')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (!isOwnerOrJoe) return
    fetch('/api/personal')
      .then(r => r.ok ? r.json() : [])
      .then(d => setPersonalEntries(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [isOwnerOrJoe])

  // Personal entries for the selected direction, keyed by date -- lets the
  // Personal view show which entries (item + category) made up that day's
  // total. The In/Out toggle is what keeps this in sync with what Personal
  // itself shows (both directions), not just GP Out.
  const personalOutByDate = useMemo(() => {
    const map = new Map<string, PersonalEntry[]>()
    for (const e of personalEntries) {
      if (e.direction !== personalDirection) continue
      const d = String(e.entry_date).slice(0, 10)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    }
    return map
  }, [personalEntries, personalDirection])

  // The Personal (GP Out only) view is built straight from
  // grony_personal_ledger, not from cash_at_bank rows -- cash_at_bank only
  // has a row for a date when some other shop transaction (sale/expense/
  // bill/etc.) "ensured" one, and it's capped to the last 90 days, so
  // driving this view off it silently dropped Personal entries on days
  // with no other activity, or older than 90 days.
  const personalOutRows = useMemo(() => {
    return Array.from(personalOutByDate.entries())
      .map(([date, entries]) => ({ date, total: entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), entries }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [personalOutByDate])

  // Fixed CATEGORIES plus any custom category already in use, so a category
  // typed in via "+ Add new category…" stays selectable/filterable.
  const personalAllCategories = useMemo(() => {
    const custom = personalEntries.map(e => e.category).filter((c): c is string => !!c && !CATEGORIES.includes(c))
    return [...CATEGORIES, ...Array.from(new Set(custom)).sort()]
  }, [personalEntries])

  useEffect(() => { loadRows() }, [])

  // Driven by the RoleBar "+" shortcut menu -- a signal that increments each
  // time "CAB Confirm" is picked, so it re-fires even if this tab is already
  // open and mounted.
  useEffect(() => {
    if (openConfirmSignal) openConfirmForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConfirmSignal])

  function openConfirmForm() {
    setConfirmDate(rows.find(r => r.cab_total == null)?.entry_date?.slice(0, 10) ?? rows[0]?.entry_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
    setConfirmBank(''); setConfirmMomo(''); setConfirmPhysical(''); setConfirmError(null)
    setShowConfirmForm(true)
  }

  async function saveConfirm() {
    if (!confirmDate || confirmBank === '' || confirmMomo === '' || confirmPhysical === '') {
      setConfirmError('All fields are required'); return
    }
    setConfirmSaving(true)
    setConfirmError(null)
    const res = await fetch('/api/cash-at-bank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_date: confirmDate, cab_bank: Number(confirmBank), cab_momo: Number(confirmMomo), cab_physical: Number(confirmPhysical),
      }),
    })
    setConfirmSaving(false)
    if (res.ok) {
      setShowConfirmForm(false)
      loadRows()
      setFlags(null)
    } else {
      const d = await res.json().catch(() => null)
      setConfirmError(d?.error ?? 'Could not save confirmation')
    }
  }

  useEffect(() => {
    if (!flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => { setFlags({ uncheckedCab: [] }); setFlagsLoading(false) })
    }
  }, [flags, flagsLoading])

  // Weekly summary derived straight from the same 90-day rows the List view
  // shows -- no separate endpoint, so it can never disagree with what's on
  // screen. Confirmed/deficit come from whichever day in the week has a
  // cab_total recorded (there's normally at most one confirmation per week).
  const weeks = useMemo<WeekSummary[]>(() => {
    const byWeek = new Map<string, Row[]>()
    for (const r of rows) {
      const wStart = isoWeekStart(String(r.entry_date).slice(0, 10))
      if (!byWeek.has(wStart)) byWeek.set(wStart, [])
      byWeek.get(wStart)!.push(r)
    }
    return Array.from(byWeek.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([weekStart, weekRows]) => {
        const confirmedRow = weekRows.find(r => r.cab_total != null)
        return {
          weekStart, weekEnd: addDays(weekStart, 6),
          net: weekRows.reduce((s, r) => s + (Number(r.daily_net) || 0), 0),
          runningEnd: weekRows[0]?.running_cash_at_bank ?? null,
          confirmed: !!confirmedRow,
          cabTotal: confirmedRow?.cab_total ?? null,
          deficit: confirmedRow?.deficit ?? null,
        }
      })
  }, [rows])
  const visibleWeeks = onlyUnconfirmed ? weeks.filter(w => !w.confirmed) : weeks
  const confirmedRows = rows.filter(r => r.cab_total != null && Number(r.cab_total) !== 0)
  const baseDailyRows = confirmedColsOnly ? confirmedRows : rows
  function toggleCategory(cat: string) {
    setCategoryFilter(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  function openAddPersonal() {
    setAddDate(new Date().toISOString().slice(0, 10))
    setAddDesc(''); setAddAmt(''); setAddDir(personalDirection); setAddCat('Other'); setAddCatCustom(false); setAddSubcat(''); setAddNotes('')
    setShowAddPersonal(true)
  }

  async function addPersonalEntry() {
    if (!addDate || !addDesc || !addAmt) return
    setAddSaving(true)
    const subcategory = addCat === 'Children' ? (addSubcat || null) : null
    const res = await fetch('/api/personal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: addDate, description: addDesc, amount: parseFloat(addAmt), direction: addDir, category: addCat, subcategory, notes: addNotes || null }),
    })
    const data = await res.json()
    setAddSaving(false)
    if (data.id) {
      setPersonalEntries(prev => [{ id: data.id, entry_date: addDate, description: addDesc, amount: addAmt, direction: addDir, category: addCat, subcategory, notes: addNotes || null, needs_review: false }, ...prev])
      setShowAddPersonal(false)
    }
  }

  async function saveEntryCategory(id: number) {
    const subcategory = editEntryCat === 'Children' ? (editEntrySubcat || null) : null
    await fetch('/api/personal', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, category: editEntryCat, subcategory }),
    })
    setPersonalEntries(prev => prev.map(e => e.id === id ? { ...e, category: editEntryCat, subcategory } : e))
    setEditEntryId(null)
    setEditEntryCatCustom(false)
  }

  async function deleteEntry(id: number) {
    await fetch('/api/personal', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPersonalEntries(prev => prev.filter(e => e.id !== id))
    setDeleteEntryConfirmId(null)
  }

  function toggleEntryRow(id: number) {
    setOpenEntryRow(prev => prev === id ? null : id)
    setEditEntryId(null); setEditEntryCatCustom(false); setDeleteEntryConfirmId(null); setSplitEntryId(null)
  }

  // Some ledger entries were bulk-imported with two or three items merged
  // into one description/amount (e.g. "Maa Julie TNT = 100, Children's
  // Coupon = 140"). Splitting keeps the original id for the first part
  // (so its history stays attached) and creates a fresh entry per
  // additional part on the same date/direction/category.
  function openSplit(e: PersonalEntry) {
    setSplitEntryId(e.id)
    setSplitParts([{ description: e.description, amount: e.amount }, { description: '', amount: '' }])
    setEditEntryId(null); setEditEntryCatCustom(false); setDeleteEntryConfirmId(null)
  }

  function updateSplitPart(i: number, field: 'description' | 'amount', value: string) {
    setSplitParts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  async function saveSplit(entry: PersonalEntry) {
    const valid = splitParts.filter(p => p.description.trim() && p.amount.trim())
    if (valid.length < 2) return
    setSplitSaving(true)
    const [first, ...rest] = valid
    await fetch('/api/personal', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, description: first.description, amount: parseFloat(first.amount), needs_review: false }),
    })
    const newEntries: PersonalEntry[] = []
    for (const part of rest) {
      const res = await fetch('/api/personal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: entry.entry_date, description: part.description, amount: parseFloat(part.amount),
          direction: entry.direction, category: entry.category ?? 'Other', subcategory: entry.subcategory, notes: entry.notes, needs_review: false,
        }),
      })
      const data = await res.json()
      if (data.id) {
        newEntries.push({
          id: data.id, entry_date: entry.entry_date, description: part.description, amount: part.amount,
          direction: entry.direction, category: entry.category, subcategory: entry.subcategory, notes: entry.notes, needs_review: false,
        })
      }
    }
    setPersonalEntries(prev => [
      ...prev.map(e => e.id === entry.id ? { ...e, description: first.description, amount: first.amount, needs_review: false } : e),
      ...newEntries,
    ])
    setSplitSaving(false)
    setSplitEntryId(null)
    setSplitParts([])
  }

  // Shared by both the By Category cell panel and the plain GP Out row
  // panel -- same Recategorize/Split/Remove controls either way, just
  // triggered from a different tap target.
  function renderEntryEditor(e: PersonalEntry) {
    const cat = e.category ?? 'Other'
    if (splitEntryId === e.id) {
      return (
        <div key={e.id} className="bg-white border border-blue-200 rounded-lg px-2 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-600">
            Split into {splitParts.length} — total {fmtn(splitParts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0))}
            {' '}(original {fmtn(parseFloat(e.amount))})
          </p>
          {splitParts.map((p, pi) => (
            <div key={pi} className="flex items-center gap-1">
              <input value={p.description} onChange={ev => updateSplitPart(pi, 'description', ev.target.value)} placeholder="Description"
                className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
              <input type="number" min="0" step="any" value={p.amount} onChange={ev => updateSplitPart(pi, 'amount', ev.target.value)} placeholder="Amount"
                className="w-20 border border-gray-200 rounded px-1.5 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
              {splitParts.length > 2 && (
                <button onClick={() => setSplitParts(prev => prev.filter((_, idx) => idx !== pi))}
                  className="text-[10px] text-gray-400 hover:text-red-500">✕</button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button onClick={() => setSplitParts(prev => [...prev, { description: '', amount: '' }])}
              className="text-[10px] text-blue-600 hover:underline">+ Add part</button>
            <button onClick={() => saveSplit(e)} disabled={splitSaving || splitParts.filter(p => p.description.trim() && p.amount.trim()).length < 2}
              className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-semibold disabled:opacity-40">
              {splitSaving ? 'Saving…' : 'Save Split'}
            </button>
            <button onClick={() => { setSplitEntryId(null); setSplitParts([]) }}
              className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">Cancel</button>
          </div>
        </div>
      )
    }
    return (
      <div key={e.id} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
        <div className="min-w-0">
          <p className="text-xs text-gray-800">{e.description}{e.subcategory ? ` (${e.subcategory})` : ''}</p>
          <p className="text-[10px] text-gray-400">{fmtn(parseFloat(e.amount))}</p>
          {e.needs_review && (
            <span className="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ Needs split</span>
          )}
        </div>
        {editEntryId === e.id ? (
          editEntryCatCustom ? (
            <div className="flex items-center gap-1 shrink-0">
              <input value={editEntryCat} onChange={ev => setEditEntryCat(ev.target.value)} placeholder="New category" autoFocus
                className="w-28 border border-blue-300 rounded px-1.5 py-0.5 text-[10px] outline-none" />
              <button onClick={() => saveEntryCategory(e.id)} className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-semibold">Save</button>
              <button onClick={() => { setEditEntryId(null); setEditEntryCatCustom(false) }} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              <select value={editEntryCat} onChange={ev => {
                  if (ev.target.value === '__new__') { setEditEntryCatCustom(true); setEditEntryCat('') } else setEditEntryCat(ev.target.value)
                  setEditEntrySubcat('')
                }}
                className="border border-blue-300 rounded px-1.5 py-0.5 text-[10px] outline-none">
                {personalAllCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Add new category…</option>
              </select>
              {editEntryCat === 'Children' && (
                <select value={editEntrySubcat} onChange={ev => setEditEntrySubcat(ev.target.value)}
                  className="border border-blue-300 rounded px-1.5 py-0.5 text-[10px] outline-none">
                  <option value="">Which child?</option>
                  {CHILDREN_SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <button onClick={() => saveEntryCategory(e.id)} className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-semibold">Save</button>
              <button onClick={() => setEditEntryId(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">✕</button>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {deleteEntryConfirmId === e.id ? (
              <>
                <span className="text-[10px] text-gray-500">Remove?</span>
                <button onClick={() => deleteEntry(e.id)} className="text-[10px] text-red-600 font-semibold hover:underline">Yes</button>
                <button onClick={() => setDeleteEntryConfirmId(null)} className="text-[10px] text-gray-500 hover:underline">No</button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditEntryId(e.id); setEditEntryCat(cat); setEditEntryCatCustom(false); setEditEntrySubcat(e.subcategory ?? '') }}
                  className="text-[10px] text-blue-600 hover:underline">Recategorize</button>
                <button onClick={() => openSplit(e)} className="text-[10px] text-purple-600 hover:underline">Split</button>
                <button onClick={() => setDeleteEntryConfirmId(e.id)} className="text-[10px] text-red-500 hover:underline">Remove</button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }


  const displayRows = baseDailyRows
  const personalAmountLabel = personalDirection === 'out' ? 'GP Out' : 'Received'
  const personalAmountCls = personalDirection === 'out' ? 'text-orange-500' : 'text-green-600'

  // Flattened one row per entry -- entries sharing a date (most visibly two
  // parts of the same Split) used to get summed into one row/cell, which
  // undid the whole point of splitting them apart. Each entry keeps its own
  // row everywhere in this view now; only which entries show is filtered.
  const personalOutEntryRows = personalOutRows.flatMap(r => r.entries.map(e => ({ date: r.date, entry: e })))
  const filteredPersonalOutEntryRows = categoryFilter.size === 0
    ? personalOutEntryRows
    : personalOutEntryRows.filter(({ entry: e }) => categoryFilter.has(e.category ?? 'Other'))

  // By Category pivots the same entries into one column per category -- the
  // checkbox filter picks which categories become columns instead of
  // narrowing which rows show, since every column here is one category.
  const pivotCategories = categoryFilter.size === 0
    ? personalAllCategories.filter(cat => personalOutRows.some(r => r.entries.some(e => (e.category ?? 'Other') === cat)))
    : personalAllCategories.filter(cat => categoryFilter.has(cat))
  const pivotEntryRows = personalOutEntryRows.filter(({ entry: e }) => pivotCategories.includes(e.category ?? 'Other'))

  // Per confirmed day: does prior confirmed total + net movement since then
  // (a running total spanning only that one gap) land on this day's
  // confirmed total? Verifies each confirmation against the one before it,
  // independent of the all-time running_cash_at_bank the Diff column checks.
  const verifyMap = useMemo(() => {
    const map = new Map<string, { ok: boolean; expected: number; diff: number }>()
    const asc = [...rows].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)))
    let prevTotal: number | null = null
    let netSincePrev = 0
    for (const r of asc) {
      const date = String(r.entry_date).slice(0, 10)
      netSincePrev = parseFloat((netSincePrev + (Number(r.daily_net) || 0)).toFixed(4))
      const isConfirmed = r.cab_total != null && Number(r.cab_total) !== 0
      if (isConfirmed) {
        const total = Number(r.cab_total)
        if (prevTotal != null) {
          const expected = parseFloat((prevTotal + netSincePrev).toFixed(2))
          const diff = parseFloat((total - expected).toFixed(2))
          map.set(date, { ok: Math.abs(diff) < 0.01, expected, diff })
        }
        prevTotal = total
        netSincePrev = 0
      }
    }
    return map
  }, [rows])

  const latest = rows[0]
  const latestConfirmed = rows.find(r => r.cab_total != null)
  const unconfirmedCount = flags?.uncheckedCab?.length ?? 0

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-3 gap-1.5 px-2 py-2 shrink-0">
        <StatCard label="Running Balance" value={fmtn(latest?.running_cash_at_bank)} sub={latest ? fmtDate(String(latest.entry_date).slice(0,10)) : undefined} tone="blue" />
        <StatCard label="Last Confirmed" value={latestConfirmed ? fmtn(latestConfirmed.cab_total) : '—'} sub={latestConfirmed ? fmtDate(String(latestConfirmed.entry_date).slice(0,10)) : 'No confirmations yet'} tone="green" />
        <StatCard label="Unconfirmed Weeks" value={flagsLoading ? '…' : String(unconfirmedCount)} tone={unconfirmedCount > 0 ? 'red' : 'green'} />
      </div>
      <div className="px-2 pb-2 shrink-0 space-y-1.5"><DynamicTasksSection scopeKey="CAB" /><AssignWidget type="unchecked_cab" /></div>

      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={() => setShowWeekly(false)}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${!showWeekly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Daily
        </button>
        <button onClick={() => setShowWeekly(true)}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${showWeekly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Weekly
          {unconfirmedCount > 0 && (
            <span className="ml-1 bg-red-100 text-red-600 text-[8px] font-bold px-1 py-0.5 rounded-full">{unconfirmedCount}</span>
          )}
        </button>
        <button onClick={openConfirmForm}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded transition bg-green-600 text-white hover:bg-green-700">
          + New CAB Confirm
        </button>
        {showWeekly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={onlyUnconfirmed} onChange={() => setOnlyUnconfirmed(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Unconfirmed only
          </label>
        )}
        {!showWeekly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={hideBankMomoPhysical} onChange={() => setHideBankMomoPhysical(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Confirmed 3
          </label>
        )}
        {!showWeekly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
            <input type="checkbox" checked={confirmedColsOnly} onChange={() => setConfirmedColsOnly(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Confirmed CAB check
          </label>
        )}
        {!showWeekly && !confirmedColsOnly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
            <input type="checkbox" checked={gpOutOnly} onChange={() => setGpOutOnly(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Personal
          </label>
        )}
      </div>

      {!showWeekly && gpOutOnly && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <button onClick={openAddPersonal}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded transition bg-blue-600 text-white hover:bg-blue-700">
            + Add
          </button>
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            <button onClick={() => setPersonalDirection('out')}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${personalDirection === 'out' ? 'bg-orange-500 text-white' : 'text-gray-600'}`}>
              Out
            </button>
            <button onClick={() => setPersonalDirection('in')}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${personalDirection === 'in' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>
              In
            </button>
          </div>
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
            <input type="checkbox" checked={byCategory} onChange={() => setByCategory(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            By Category
          </label>
          {personalAllCategories.map(cat => (
            <label key={cat} className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
              <input type="checkbox" checked={categoryFilter.has(cat)} onChange={() => toggleCategory(cat)}
                className="w-3 h-3 accent-blue-600" />
              {CAT_ICON[cat] ?? '🏷️'} {cat}
            </label>
          ))}
          {categoryFilter.size > 0 && (
            <button onClick={() => setCategoryFilter(new Set())}
              className="text-[9px] font-semibold text-blue-600 hover:underline">
              Clear
            </button>
          )}
        </div>
      )}

      {!showWeekly && gpOutOnly && showAddPersonal && (
        <div className="px-2 py-2 border-b border-gray-200 bg-blue-50/60 shrink-0 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-700">New Personal Entry</p>
          <div className="flex flex-wrap items-end gap-1.5">
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
              <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Description</p>
              <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description"
                className="w-40 bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Amount</p>
              <input type="number" min="0" step="any" value={addAmt} onChange={e => setAddAmt(e.target.value)}
                placeholder="0" className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Direction</p>
              <select value={addDir} onChange={e => setAddDir(e.target.value as 'out' | 'in')}
                className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400">
                <option value="out">Out (expense)</option>
                <option value="in">In (received)</option>
              </select>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Category</p>
              {addCatCustom ? (
                <div className="flex items-center gap-1">
                  <input value={addCat} onChange={e => setAddCat(e.target.value)} placeholder="New category name" autoFocus
                    className="w-32 bg-white border border-blue-300 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
                  <button type="button" onClick={() => { setAddCatCustom(false); setAddCat('Other') }}
                    className="text-[9px] text-gray-500 underline whitespace-nowrap">Existing</button>
                </div>
              ) : (
                <select value={addCat} onChange={e => {
                    if (e.target.value === '__new__') { setAddCatCustom(true); setAddCat('') } else setAddCat(e.target.value)
                    setAddSubcat('')
                  }}
                  className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400">
                  {personalAllCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ Add new category…</option>
                </select>
              )}
            </div>
            {addCat === 'Children' && !addCatCustom && (
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Which child?</p>
                <select value={addSubcat} onChange={e => setAddSubcat(e.target.value)}
                  className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">Optional</option>
                  {CHILDREN_SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Notes</p>
              <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Optional"
                className="w-32 bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <button onClick={addPersonalEntry} disabled={addSaving || !addDate || !addDesc || !addAmt}
              className="text-[9px] font-semibold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {addSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowAddPersonal(false)}
              className="text-[9px] font-semibold px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showConfirmForm && (
        <div className="px-2 py-2 border-b border-gray-200 bg-green-50/60 shrink-0 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-700">New CAB Confirm</p>
          <div className="flex flex-wrap items-end gap-1.5">
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
              <input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Bank</p>
              <input type="number" min="0" step="any" value={confirmBank} onChange={e => setConfirmBank(e.target.value)}
                placeholder="0" className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">MoMo</p>
              <input type="number" min="0" step="any" value={confirmMomo} onChange={e => setConfirmMomo(e.target.value)}
                placeholder="0" className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Physical</p>
              <input type="number" min="0" step="any" value={confirmPhysical} onChange={e => setConfirmPhysical(e.target.value)}
                placeholder="0" className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Total</p>
              <p className="text-[11px] font-bold text-blue-600 px-2 py-1">
                {fmtn((Number(confirmBank) || 0) + (Number(confirmMomo) || 0) + (Number(confirmPhysical) || 0))}
              </p>
            </div>
            <button onClick={saveConfirm} disabled={confirmSaving}
              className="text-[9px] font-semibold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {confirmSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowConfirmForm(false)}
              className="text-[9px] font-semibold px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
              Cancel
            </button>
          </div>
          {confirmError && <p className="text-[9px] text-red-500">{confirmError}</p>}
        </div>
      )}

      {showWeekly ? (
        <div className="flex-1 overflow-auto min-h-0 p-2">
          <p className="text-[10px] text-gray-400 mb-1.5">Last {weeks.length} week{weeks.length !== 1 ? 's' : ''} (Mon–Sun), most recent first.</p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap">Week</th>
                  <th className="text-right px-3 py-2 font-bold border-b border-gray-200">Net</th>
                  <th className="text-right px-3 py-2 font-bold border-b border-gray-200">Week-End Balance</th>
                  <th className="text-center px-3 py-2 font-bold border-b border-gray-200">Status</th>
                  <th className="text-right px-3 py-2 font-bold text-blue-500 border-b border-gray-200">Confirmed</th>
                  <th className="text-right px-3 py-2 font-bold text-red-400 border-b border-gray-200">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleWeeks.map((w, i) => (
                  <tr key={w.weekStart} className={i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'}>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">{fmtDate(w.weekStart)} – {fmtDate(w.weekEnd)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${w.net >= 0 ? 'text-gray-800' : 'text-red-500'}`}>{fmtn(w.net)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtn(w.runningEnd)}</td>
                    <td className="px-3 py-2 text-center">
                      {w.confirmed
                        ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">✓ CONFIRMED</span>
                        : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">NOT CONFIRMED</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600">{w.confirmed ? fmtn(w.cabTotal) : ''}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${w.deficit != null && Number(w.deficit) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {w.deficit != null ? fmtn(w.deficit) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleWeeks.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-10">
              {onlyUnconfirmed ? 'Every week in range is confirmed.' : 'No data'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0 p-2">
          <p className="text-[10px] text-gray-400 mb-1.5">Last 90 days, most recent first.</p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              {gpOutOnly && byCategory ? (
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap">Date</th>
                  {pivotCategories.map(cat => (
                    <th key={cat} className="text-right px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap">{CAT_ICON[cat] ?? '🏷️'} {cat}</th>
                  ))}
                </tr>
              ) : gpOutOnly ? (
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap">Date</th>
                  <th className={`text-right px-3 py-2 font-bold border-b border-gray-200 ${personalAmountCls}`} title={personalDirection === 'out' ? "Cash taken out for Grony's personal use" : "Cash received by Grony personally"}>{personalAmountLabel}</th>
                  <th className="text-left px-3 py-2 font-bold border-b border-gray-200 border-l-2 border-gray-300">Item</th>
                  <th className="text-left px-3 py-2 font-bold border-b border-gray-200">Category</th>
                </tr>
              ) : confirmedColsOnly ? (
                <>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                    <th rowSpan={2} className="text-left px-3 py-2 font-bold border-b border-gray-200 align-bottom whitespace-nowrap">Date</th>
                    <th colSpan={hideBankMomoPhysical ? 2 : 5} className="text-center px-3 py-1.5 font-bold border-b border-gray-100 border-x-2 border-gray-300">Confirmed (physical count)</th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                    {!hideBankMomoPhysical && (
                      <>
                        <th className="text-right px-3 py-1.5 font-bold border-b border-gray-200 border-l-2 border-gray-300">Bank</th>
                        <th className="text-right px-3 py-1.5 font-bold border-b border-gray-200">MoMo</th>
                        <th className="text-right px-3 py-1.5 font-bold border-b border-gray-200">Physical</th>
                      </>
                    )}
                    <th className={`text-right px-3 py-1.5 font-bold border-b border-gray-200 text-blue-500 ${hideBankMomoPhysical ? 'border-l-2 border-gray-300' : ''}`}>Total</th>
                    <th className="text-center px-3 py-1.5 font-bold border-b border-gray-200 border-r-2 border-gray-300" title="Checks this confirmation against the previous one: prior confirmed total + net movement since then">Verify</th>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                    <th rowSpan={2} className="text-left px-3 py-2 font-bold border-b border-gray-200 align-bottom whitespace-nowrap">Date</th>
                    <th colSpan={hideBankMomoPhysical ? 2 : 5} className="text-center px-3 py-1.5 font-bold border-b border-gray-100 border-x-2 border-gray-300">Confirmed (physical count)</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold border-b border-gray-200 align-bottom" title="Cash Counted">CC</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold text-green-500 border-b border-gray-200 align-bottom" title="Grony Personal cash paid into the business that day">GP In</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold text-green-500 border-b border-gray-200 align-bottom" title="Debtor repayments received that day">Debtors</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold border-b border-gray-200 align-bottom" title="Bills paid to vendors">Bills</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold border-b border-gray-200 align-bottom" title="Expenses">Exp</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold text-orange-500 border-b border-gray-200 align-bottom" title="Cash taken out for Grony's personal use">GP Out</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold border-b border-gray-200 align-bottom" title="Net cash movement for the day">Net</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold border-b border-gray-200 align-bottom" title="Running cash-at-bank balance, carried day to day">Running</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-bold text-red-400 border-b border-gray-200 align-bottom" title="Confirmed total minus Running balance">Diff</th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                    {!hideBankMomoPhysical && (
                      <>
                        <th className="text-right px-3 py-1.5 font-bold border-b border-gray-200 border-l-2 border-gray-300">Bank</th>
                        <th className="text-right px-3 py-1.5 font-bold border-b border-gray-200">MoMo</th>
                        <th className="text-right px-3 py-1.5 font-bold border-b border-gray-200">Physical</th>
                      </>
                    )}
                    <th className={`text-right px-3 py-1.5 font-bold border-b border-gray-200 text-blue-500 ${hideBankMomoPhysical ? 'border-l-2 border-gray-300' : ''}`}>Total</th>
                    <th className="text-center px-3 py-1.5 font-bold border-b border-gray-200 border-r-2 border-gray-300" title="Checks this confirmation against the previous one: prior confirmed total + net movement since then">Verify</th>
                  </tr>
                </>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gpOutOnly && byCategory ? pivotEntryRows.map(({ date, entry: e }, i) => {
                const cat = e.category ?? 'Other'
                const isOpen = openEntryRow === e.id
                return (
                  <Fragment key={e.id}>
                    <tr className={isOpen ? 'bg-blue-50' : i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'}>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap align-top">{fmtDate(date)}</td>
                      {pivotCategories.map(pc => (
                        <td key={pc}
                          onClick={() => pc === cat && toggleEntryRow(e.id)}
                          className={`px-3 py-2 text-right align-top ${pc === cat ? 'cursor-pointer hover:bg-blue-50/60' : ''}`}>
                          {pc === cat && (
                            <>
                              <div className="font-semibold text-gray-800">{fmtn(parseFloat(e.amount))}</div>
                              <div className="text-[9px] text-gray-400 font-normal">{e.description}{e.subcategory ? ` (${e.subcategory})` : ''}</div>
                              {e.needs_review && <span className="text-[9px]" title="Needs split">⚠</span>}
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                    {isOpen && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={1 + pivotCategories.length} className="px-3 py-3">
                          <p className="text-[10px] font-semibold text-gray-700 mb-1.5">{fmtDate(date)} · {CAT_ICON[cat] ?? '🏷️'} {cat}</p>
                          {renderEntryEditor(e)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              }) : gpOutOnly ? filteredPersonalOutEntryRows.map(({ date, entry: e }, i) => {
                const isOpen = openEntryRow === e.id
                return (
                  <Fragment key={e.id}>
                    <tr className={`cursor-pointer ${isOpen ? 'bg-blue-50' : i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'}`} onClick={() => toggleEntryRow(e.id)}>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap align-top">{fmtDate(date)}</td>
                      <td className={`px-3 py-2 text-right align-top ${personalAmountCls}`}>{fmtn(parseFloat(e.amount))}</td>
                      <td className="px-3 py-2 text-gray-800 border-l-2 border-gray-300 align-top">
                        {e.description}
                        {e.needs_review && (
                          <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ Needs split</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${CAT_COLOR[e.category ?? 'Other'] ?? CAT_COLOR['Other']}`}>
                          {CAT_ICON[e.category ?? 'Other'] ?? '🏷️'} {e.category ?? 'Other'}{e.subcategory ? ` · ${e.subcategory}` : ''}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={4} className="px-3 py-3">
                          <p className="text-[10px] font-semibold text-gray-700 mb-1.5">{fmtDate(date)}</p>
                          {renderEntryEditor(e)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              }) : displayRows.map((r, i) => {
                const hasConfirm = r.cab_total != null
                const net = Number(r.daily_net)
                const stripe = i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'
                const dateKey = String(r.entry_date).slice(0, 10)
                const verify = verifyMap.get(dateKey)
                const verifyCell = (
                  <td className="px-3 py-2 text-center border-r-2 border-gray-300" title={verify ? `Expected ${fmtn(verify.expected)}, diff ${fmtn(verify.diff)}` : undefined}>
                    {verify && (verify.ok
                      ? <span className="text-green-600 font-bold">✓</span>
                      : (
                        <div className="leading-tight">
                          <span className="text-red-500 font-bold">✗</span>
                          {/* Diff shown inline, not just in the title -- hover
                              tooltips aren't reachable on mobile touch. */}
                          <div className="text-[9px] text-red-500 font-semibold whitespace-nowrap">
                            {verify.diff > 0 ? '+' : ''}{fmtn(verify.diff)}
                          </div>
                        </div>
                      ))}
                  </td>
                )
                const bmpCells = !hideBankMomoPhysical && (
                  <>
                    <td className="px-3 py-2 text-right text-gray-500 border-l-2 border-gray-300">{nz(r.cab_bank)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{nz(r.cab_momo)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{nz(r.cab_physical)}</td>
                  </>
                )
                const totalCls = `px-3 py-2 text-right text-blue-600 font-semibold ${hideBankMomoPhysical ? 'border-l-2 border-gray-300' : ''}`
                return confirmedColsOnly ? (
                  <tr key={r.entry_date} className={stripe}>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(dateKey)}</td>
                    {bmpCells}
                    <td className={totalCls}>{fmtn(r.cab_total)}</td>
                    {verifyCell}
                  </tr>
                ) : (
                  <tr key={r.entry_date} className={stripe}>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(dateKey)}</td>
                    {bmpCells}
                    <td className={totalCls}>{hasConfirm ? fmtn(r.cab_total) : ''}</td>
                    {verifyCell}
                    <td className="px-3 py-2 text-right text-gray-700">{nz(r.cash_counted)}</td>
                    <td className="px-3 py-2 text-right text-green-600">{nz(r.grony_personal_cash_in)}</td>
                    <td className="px-3 py-2 text-right text-green-600">{nz(r.debtors_cash_in)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{nz(r.bills)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{nz(r.expenses)}</td>
                    <td className="px-3 py-2 text-right text-orange-500">{nz(r.grony_personal_expenses)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${net >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                      {fmtn(r.daily_net)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtn(r.running_cash_at_bank)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${r.deficit != null && Number(r.deficit) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {r.deficit != null ? fmtn(r.deficit) : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {(gpOutOnly && byCategory ? pivotEntryRows.length === 0 : gpOutOnly ? filteredPersonalOutEntryRows.length === 0 : displayRows.length === 0) && (
            <p className="text-xs text-gray-400 text-center py-10">
              {gpOutOnly ? `No ${personalAmountLabel} entries in range.` : confirmedColsOnly ? 'No confirmed days in range.' : 'No data'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
