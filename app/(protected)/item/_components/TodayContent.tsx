'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import DayBookFeed from '@/components/DayBookFeed'

const fmt = (v: any) => `₵${Number(v ?? 0).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`

function Section({ title, href, linkLabel, children }: { title: string; children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{title}</p>
        {href && (
          <Link href={href} className="text-[10px] text-blue-600 font-semibold">
            {linkLabel ?? 'View →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-[1px] text-[11px] leading-tight">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${valueClass ?? 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function agePhrase(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'for 1 day now'
  return `for ${days} days now`
}

function oldestDays(rows: any[], field: string): number | null {
  if (!rows.length) return null
  return Math.max(...rows.map(r => daysSince(r[field])))
}

function timeOfDay(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const AUTO_PENALIZABLE = new Set(['missing_days', 'no_cash', 'cost_gte_sell', 'no_staff_times', 'unchecked_cab'])

export default function TodayPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const canPost = ['owner', 'manager'].includes(role)

  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<any | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [vSettings, setVSettings] = useState<Record<string, string>>({})
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [showPost, setShowPost] = useState(false)
  const [postText, setPostText] = useState('')
  const [posting, setPosting] = useState(false)
  const [logs, setLogs] = useState<any[]>([])

  function loadAnnouncements() {
    fetch('/api/announcements').then(r => r.ok ? r.json() : []).then(d => setAnnouncements(Array.isArray(d) ? d : [])).catch(() => {})
  }

  async function postAnnouncement() {
    if (!postText.trim()) return
    setPosting(true)
    const res = await fetch('/api/announcements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: postText.trim() }),
    })
    setPosting(false)
    if (res.ok) { setPostText(''); setShowPost(false); loadAnnouncements() }
  }

  async function removeAnnouncement(id: number) {
    await fetch('/api/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadAnnouncements()
  }

  function loadLogs() {
    fetch('/api/logs').then(r => r.ok ? r.json() : []).then(d => {
      const todayStr = new Date().toISOString().slice(0, 10)
      const todays = (Array.isArray(d) ? d : []).filter((l: any) => String(l.created_at).slice(0, 10) === todayStr)
      setLogs(todays.slice(0, 12))
    }).catch(() => {})
  }

  function load() {
    fetch('/api/today/summary')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  function loadFlags() {
    fetch('/api/flags')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setFlags)
      .catch(() => {})
  }
  function loadAssignments() {
    fetch('/api/violations/assignments')
      .then(r => r.json())
      .then(d => { setAssignments(d.assignments ?? {}); setVSettings(d.settings ?? {}) })
      .catch(() => {})
  }

  useEffect(() => { load(); loadFlags(); loadAssignments(); loadAnnouncements(); loadLogs() }, [])
  usePolling(load, 10000)
  usePolling(loadFlags, 30000)
  usePolling(loadAnnouncements, 30000)
  usePolling(loadLogs, 15000)

  const violations = useMemo(() => {
    if (!flags) return []
    const list: { type: string; label: string; count: number; days: number | null; href: string }[] = []
    if (flags.missingDays?.length) list.push({
      type: 'missing_days',
      label: 'Sales Receipt' + (flags.missingDays.length !== 1 ? 's' : '') + ' still not entered',
      count: flags.missingDays.length, days: oldestDays(flags.missingDays, 'missing_date'), href: '/sales?tab=Missing Days',
    })
    if (flags.noCash?.length) list.push({
      type: 'no_cash',
      label: 'walk-in receipt' + (flags.noCash.length !== 1 ? 's' : '') + ' missing cash counted',
      count: flags.noCash.length, days: oldestDays(flags.noCash, 'receipt_date'), href: '/sales?tab=No Cash',
    })
    if (flags.costGteSell?.length) list.push({
      type: 'cost_gte_sell',
      label: 'Cost Price' + (flags.costGteSell.length !== 1 ? 's' : '') + ' ≥ Selling Price still unresolved',
      count: flags.costGteSell.length, days: oldestDays(flags.costGteSell, 'receipt_date'), href: '/sales?tab=Cost Price',
    })
    if (flags.noStaffTimes?.length) list.push({
      type: 'no_staff_times',
      label: 'day' + (flags.noStaffTimes.length !== 1 ? 's' : '') + ' with no staff times recorded',
      count: flags.noStaffTimes.length, days: oldestDays(flags.noStaffTimes, 'missing_date'), href: '/staff?tab=No Times',
    })
    if (flags.uncheckedCab?.length) list.push({
      type: 'unchecked_cab',
      label: 'week' + (flags.uncheckedCab.length !== 1 ? 's' : '') + ' with no Cash at Bank confirmation',
      count: flags.uncheckedCab.length, days: oldestDays(flags.uncheckedCab, 'week_start'), href: '/cash-at-bank?tab=CAB Weekly',
    })
    if (flags.noGroup?.length) list.push({
      type: 'no_group',
      label: 'item' + (flags.noGroup.length !== 1 ? 's' : '') + ' with no group assigned',
      count: flags.noGroup.length, days: null, href: '/item?tab=No Group',
    })
    if (flags.duplicates?.length) list.push({
      type: 'duplicates',
      label: 'possible duplicate item pair' + (flags.duplicates.length !== 1 ? 's' : ''),
      count: flags.duplicates.length, days: null, href: '/item?tab=Duplicates',
    })
    if (flags.notInInventory?.length) list.push({
      type: 'not_in_inventory',
      label: 'item name' + (flags.notInInventory.length !== 1 ? 's' : '') + ' not found in inventory',
      count: flags.notInInventory.length, days: null, href: '/item?tab=Not in Inv.',
    })
    return list.sort((a, b) => b.count - a.count)
  }, [flags])

  const totalViolations = violations.reduce((s, v) => s + v.count, 0)

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>
  if (!data) return <div className="py-10 text-center text-gray-400">Could not load today's summary.</div>

  const sales = data.sales ?? {}
  const bills = data.bills ?? {}
  const expenses = data.expenses ?? {}

  return (
    <div className="py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">Today</h1>
        <p className="text-[10px] text-gray-400">{fmtDate(data.date)}</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">📢 Announcements</p>
          {canPost && (
            <button onClick={() => setShowPost(s => !s)} className="text-[10px] text-amber-700 font-semibold">
              {showPost ? 'Cancel' : '+ Post'}
            </button>
          )}
        </div>
        {showPost && (
          <div className="flex gap-1 mb-1">
            <input value={postText} onChange={e => setPostText(e.target.value)}
              placeholder="Write an announcement…"
              className="flex-1 bg-white border border-amber-300 rounded px-2 py-1 text-[11px] text-gray-900 outline-none focus:ring-1 focus:ring-amber-400" />
            <button onClick={postAnnouncement} disabled={posting || !postText.trim()}
              className="text-[10px] font-semibold bg-amber-600 text-white px-2 py-1 rounded disabled:opacity-40">
              {posting ? '…' : 'Post'}
            </button>
          </div>
        )}
        {announcements.length === 0 ? (
          <p className="text-[11px] text-gray-400 py-[1px]">No announcements.</p>
        ) : (
          announcements.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-2 py-[2px] text-[11px] leading-tight">
              <span className="text-gray-700 min-w-0">{a.message}
                <span className="text-gray-400"> — <span className="capitalize">{a.posted_by}</span>, {timeOfDay(a.created_at)}</span>
              </span>
              {canPost && (
                <button onClick={() => removeAnnouncement(a.id)} className="text-amber-400 hover:text-red-500 font-bold shrink-0">×</button>
              )}
            </div>
          ))
        )}
      </div>

      <Section title="Sales" href="/sales">
        <Row label="Total" value={fmt(sales.total)} valueClass="text-blue-700" />
        <Row label="WIC" value={fmt(sales.wic)} />
        <Row label="GMC" value={fmt(sales.gmc)} />
        <Row label="Receipts" value={sales.count ?? 0} />
        <Link href="/sales/new" className="inline-block text-[10px] font-semibold text-blue-600 mt-0.5">+ New Sale</Link>
      </Section>

      <Section title="Bills" href="/bills">
        <Row label="Total" value={fmt(bills.total)} valueClass="text-orange-600" />
        <Row label="Bills" value={bills.count ?? 0} />
      </Section>

      <Section title="Expenses" href="/expenses">
        <Row label="Total" value={fmt(expenses.total)} valueClass="text-red-500" />
        <Row label="Entries" value={expenses.count ?? 0} />
      </Section>

      <Section title="Stock Counting" href="/stock/counts?tab=Daily" linkLabel="Count Now →">
        {data.pendingDailyCount > 0 ? (
          <Row label="Pending" value={`${data.pendingDailyCount} item${data.pendingDailyCount !== 1 ? 's' : ''}`} valueClass="text-orange-600" />
        ) : (
          <Row label="Status" value="All counted ✓" valueClass="text-green-600" />
        )}
      </Section>

      <Section title="Staff Today" href="/staff">
        {(!data.staffToday || data.staffToday.length === 0) ? (
          <p className="text-[11px] text-gray-400 py-[1px]">No one clocked in yet.</p>
        ) : (
          data.staffToday.map((s: any) => (
            <Row key={s.staff_name} label={s.staff_name} valueClass="capitalize"
              value={<><span className="text-green-700">{s.actual_in ?? '—'}</span> → <span className="text-orange-600">{s.actual_out ?? '—'}</span></>} />
          ))
        )}
      </Section>

      <Section title="Cash at Bank" href="/cash-at-bank">
        {data.latestCab ? (
          <Row label={`Confirmed ${fmtDate(String(data.latestCab.entry_date).slice(0,10))}`}
            value={data.latestCab.deficit != null ? fmt(data.latestCab.deficit) : '—'}
            valueClass={Number(data.latestCab.deficit) < 0 ? 'text-red-500' : 'text-green-600'} />
        ) : (
          <p className="text-[11px] text-gray-400 py-[1px]">No confirmed entry yet.</p>
        )}
      </Section>

      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Needs Attention {totalViolations > 0 && <span className="text-red-500">({totalViolations})</span>}
          </p>
          <Link href="/staff?tab=Assignments" className="text-[10px] text-blue-600 font-semibold">
            Assign →
          </Link>
        </div>
        {!flags ? (
          <p className="text-[11px] text-gray-400 py-[1px]">Loading…</p>
        ) : violations.length === 0 ? (
          <p className="text-[11px] text-green-600 font-medium py-[1px]">All clear ✓</p>
        ) : (
          <div>
            {violations.map(v => {
              const assignedTo = assignments[v.type]
              const canAutoPenalize = AUTO_PENALIZABLE.has(v.type)
              const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
              const atRisk = canAutoPenalize && assignedTo && v.days != null && v.days >= threshold
              return (
                <Link key={v.href} href={v.href}
                  className="flex items-center justify-between py-[2px] text-[11px] leading-tight hover:bg-gray-50 -mx-1 px-1 rounded transition gap-2">
                  <span className="min-w-0 truncate">
                    <span className="font-bold text-red-500">{v.count}</span>{' '}
                    <span className="text-gray-700">{v.label}</span>
                    {v.days != null && <span className="text-gray-400"> — {agePhrase(v.days)}</span>}
                    {assignedTo && (
                      <span className={`ml-1 ${atRisk ? 'text-red-500 font-semibold' : 'text-gray-300'}`}>
                        · <span className="capitalize">{assignedTo}</span>{atRisk && ' ⚠'}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold shrink-0">Fix →</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Today's Activity</p>
          <Link href="/logs" className="text-[10px] text-blue-600 font-semibold">View all →</Link>
        </div>
        {logs.length === 0 ? (
          <p className="text-[11px] text-gray-400 py-[1px]">No activity yet today.</p>
        ) : (
          logs.map(l => (
            <div key={l.id} className="flex items-baseline gap-1 py-[1px] text-[11px] leading-tight">
              <span className="text-gray-300 shrink-0 tabular-nums">{timeOfDay(l.created_at)}</span>
              <span className="text-gray-700 capitalize shrink-0">{l.staff_name}</span>
              <span className="text-gray-500 truncate">{l.action}{l.details ? ` ${l.details}` : ''}</span>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 border-t border-gray-200">
        <DayBookFeed />
      </div>
    </div>
  )
}
