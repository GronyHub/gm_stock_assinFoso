'use client'
import { useEffect, useState } from 'react'
import MoneyText from '@/components/MoneyText'
import type { HubCtx } from './useHubState'

type Row = { staff_name: string; actual_in: string | null; actual_out: string | null; on_break: boolean }
type Tone = 'plain' | 'good' | 'warn' | 'bad'
const TONES: Record<Tone, string> = { plain: 'border-gray-200 bg-white', good: 'border-green-200 bg-green-50', warn: 'border-amber-300 bg-amber-50', bad: 'border-red-300 bg-red-50' }
const nm = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// One summary card: a title, one big figure, a short line under it, and an arrow: tap to go to where it is dealt with.
function Card({ title, value, sub, tone = 'plain', wide = false, onClick }: { title: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone; wide?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[7.5rem] flex-col justify-between gap-2 rounded-2xl border p-3.5 text-left active:opacity-80 ${wide ? 'col-span-2' : ''} ${TONES[tone]}`}>
      <span className="flex items-center justify-between text-sm text-gray-600"><span>{title}</span><span aria-hidden="true" className="text-lg leading-none text-gray-400">›</span></span>
      <span className="text-[28px] leading-none text-gray-900">{value}</span>
      <span className="text-[13px] leading-snug text-gray-600">{sub ?? ' '}</span>
    </button>
  )
}

// The Home screen (phone): the day at a glance. Everything shown comes from numbers the app already holds, except who is
// clocked in, which is read once when Home opens. Owners, Joe and managers also see cash and flags; staff see their own sales.
export default function HubHome({ h }: { h: HubCtx }) {
  const { username, isOwnerOrJoe, showFlags, liveTodaySalesTotal, liveTaps, liveToday, salesByStaff, myDayBadge, pendingJobsBadge, liveCountProgress,
    liveSaleFlagTotal, salesFlagsCount, billsFlagsCount, cabFlagsCount, lossByDateFlagsCount, staffTimesFlagsCount, dressFlagsCount, expensesFlagsCount, customersFlagsCount, vendorsFlagsCount,
    setShop, openShop, pickLossView, goItemsMode, openEmbed } = h
  const [team, setTeam] = useState<Row[] | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/staff-times/worked-today', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (live) setTeam(Array.isArray(d?.staff) ? d.staff : []) }).catch(() => { if (live) setTeam([]) })
    return () => { live = false }
  }, [])

  const now = new Date()
  const hour = now.getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateText = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const todayTaps = (liveTaps || []).filter(t => t && !t.undone && t.tapped_at.startsWith(liveToday))
  const mySales = Number(salesByStaff?.[username.toLowerCase()] ?? 0)
  // The day's walk-in receipt carries the cash counted at closing (see the Sales Log day row).
  const ccRaw = todayTaps.find(t => !t.is_gmc && t.receipt_cash_counted != null && String(t.receipt_cash_counted) !== '')?.receipt_cash_counted
  const cash = ccRaw === undefined ? null : Number(ccRaw)
  const flagTotal = liveSaleFlagTotal + salesFlagsCount + billsFlagsCount + cabFlagsCount + lossByDateFlagsCount + staffTimesFlagsCount + dressFlagsCount + expensesFlagsCount + customersFlagsCount + vendorsFlagsCount
  const clockedIn = (team ?? []).filter(r => r.actual_in && !r.actual_out)
  const waiting = Number(myDayBadge ?? 0)
  const jobs = Number(pendingJobsBadge ?? 0)
  const countLeft = liveCountProgress ? Math.max(0, liveCountProgress.total - liveCountProgress.doneToday) : null

  // Each card first closes the Home page, then goes where the sidebar's matching button goes.
  const go = (fn: () => void) => () => { setShop(null); fn() }

  return (
    <div className="space-y-3 p-3 pb-28">
      <div>
        <h1 className="text-xl text-gray-900">{username ? `${hello}, ${nm(username)}` : hello}</h1>
        <p className="text-sm text-gray-500">{dateText}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {showFlags ? (
          <Card wide title="Sales today" onClick={go(() => goItemsMode('log'))} value={<MoneyText v={Number(liveTodaySalesTotal)} />}
            sub={`${todayTaps.length} sale${todayTaps.length === 1 ? '' : 's'} recorded · you ${mySales.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`} />
        ) : (
          <Card wide title="Your sales today" onClick={go(() => goItemsMode('log'))} value={<MoneyText v={mySales} />} sub={`Shop total ${Number(liveTodaySalesTotal).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`} />
        )}
        <Card title="Waiting for you" value={waiting} tone={waiting > 0 ? 'warn' : 'good'} sub={waiting > 0 ? 'Tap to see them' : 'Nothing waiting'} onClick={() => openShop('todo')} />
        <Card title="Pending jobs" value={jobs} tone={jobs > 0 ? 'plain' : 'good'} sub={jobs > 0 ? 'Customers’ work left with us' : 'None open'} onClick={() => openEmbed('/pending-jobs')} />
        {showFlags && (
          <Card title="Cash counted" tone={cash === null ? 'bad' : 'good'} onClick={go(() => goItemsMode('log'))}
            value={cash === null ? 'Not yet' : <MoneyText v={cash} />} sub={cash === null ? 'Count it in the Sales Log' : 'Entered for today'} />
        )}
        {showFlags && (
          <Card title="Flags" value={flagTotal} tone={flagTotal > 0 ? 'warn' : 'good'} sub={flagTotal > 0 ? 'Things to fix' : 'All clear'} onClick={go(() => pickLossView('flags'))} />
        )}
        <Card title="Counts to do" value={countLeft ?? '–'} tone={countLeft ? 'warn' : 'plain'} sub={liveCountProgress ? `${liveCountProgress.doneToday} of ${liveCountProgress.total} counted today` : 'Loading…'} onClick={go(() => pickLossView('counts'))} />
        <Card title="Team" value={team === null ? '–' : clockedIn.length} tone="plain" onClick={() => openShop('times')}
          sub={team === null ? 'Loading…' : clockedIn.length ? clockedIn.map(r => nm(r.staff_name)).join(', ') : 'Nobody clocked in yet'} />
      </div>
      {isOwnerOrJoe && <p className="px-1 pt-1 text-[12px] text-gray-400">Tap a card to go to where it is dealt with.</p>}
    </div>
  )
}
