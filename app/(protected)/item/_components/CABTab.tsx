'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import PersonalTab from './PersonalTab'

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

export default function CABTab() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const isOwnerOrJoe = role === 'owner' || username === 'joe'
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [showWeekly, setShowWeekly] = useState(false)
  const [showPersonal, setShowPersonal] = useState(false)
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(false)
  const [confirmedColsOnly, setConfirmedColsOnly] = useState(false)
  const [hideBankMomoPhysical, setHideBankMomoPhysical] = useState(false)
  const [gpOutOnly, setGpOutOnly] = useState(false)
  const [showConfirmForm, setShowConfirmForm] = useState(false)
  const [confirmDate, setConfirmDate] = useState('')
  const [confirmBank, setConfirmBank] = useState('')
  const [confirmMomo, setConfirmMomo] = useState('')
  const [confirmPhysical, setConfirmPhysical] = useState('')
  const [confirmSaving, setConfirmSaving] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  function loadRows() {
    fetch('/api/cash-at-bank')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadRows() }, [])

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
  const displayRows = gpOutOnly
    ? baseDailyRows.filter(r => r.grony_personal_expenses != null && Number(r.grony_personal_expenses) !== 0)
    : baseDailyRows

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

      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={() => { setShowWeekly(false); setShowPersonal(false) }}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${!showWeekly && !showPersonal ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Daily
        </button>
        <button onClick={() => { setShowWeekly(true); setShowPersonal(false) }}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${showWeekly && !showPersonal ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Weekly
          {unconfirmedCount > 0 && (
            <span className="ml-1 bg-red-100 text-red-600 text-[8px] font-bold px-1 py-0.5 rounded-full">{unconfirmedCount}</span>
          )}
        </button>
        <button onClick={openConfirmForm}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded transition bg-green-600 text-white hover:bg-green-700">
          + New CAB Confirm
        </button>
        {isOwnerOrJoe && (
          <button onClick={() => setShowPersonal(p => !p)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${showPersonal ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Personal
          </button>
        )}
        {!showPersonal && showWeekly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={onlyUnconfirmed} onChange={() => setOnlyUnconfirmed(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Unconfirmed only
          </label>
        )}
        {!showPersonal && !showWeekly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={hideBankMomoPhysical} onChange={() => setHideBankMomoPhysical(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Confirmed 3
          </label>
        )}
        {!showPersonal && !showWeekly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
            <input type="checkbox" checked={confirmedColsOnly} onChange={() => setConfirmedColsOnly(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Confirmed CAB check
          </label>
        )}
        {!showPersonal && !showWeekly && !confirmedColsOnly && (
          <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
            <input type="checkbox" checked={gpOutOnly} onChange={() => setGpOutOnly(o => !o)}
              className="w-3 h-3 accent-blue-600" />
            Personal (GP Out only)
          </label>
        )}
      </div>

      {showPersonal && (
        <div className="flex-1 overflow-auto min-h-0 p-2">
          <PersonalTab embedded />
        </div>
      )}

      {!showPersonal && showConfirmForm && (
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

      {!showPersonal && (showWeekly ? (
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
              {confirmedColsOnly ? (
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
              {displayRows.map((r, i) => {
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
          {displayRows.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-10">
              {gpOutOnly ? 'No days with GP Out in range.' : confirmedColsOnly ? 'No confirmed days in range.' : 'No data'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
