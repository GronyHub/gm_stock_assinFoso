'use client'
import PresentStaffBar from '../_components/PresentStaffBar'
import { StaffMemberPersonalTab, STAFF_ROSTER } from './hubShared'
import { signOut } from 'next-auth/react'
import ClockInOutPanel, { type Mine } from '../../staff/ClockInOutPanel'
import HubRecord from './HubRecord'
import MySelfChip from '../_components/MySelfChip'
import { formatPrice } from './hubShared'
import { useEffect, useState } from 'react'
import MoneyText from '@/components/MoneyText'
import type { HubCtx } from './useHubState'

type Row = { staff_name: string; actual_in: string | null; actual_out: string | null; on_break: boolean }
type Tone = 'plain' | 'good' | 'warn' | 'bad'
const TONES: Record<Tone, string> = { plain: 'border-gray-200 bg-white', good: 'border-green-200 bg-green-50', warn: 'border-amber-300 bg-amber-50', bad: 'border-red-300 bg-red-50' }
const nm = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// One summary card: a title, one big figure, a short line under it, and an arrow: tap to go to where it is dealt with.
function Card({ title, value, sub, tone = 'plain', wide = false, onClick }: { title: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone; wide?: boolean; onClick: () => void }) {
  // Five to a row: title and figure only (the note is the tooltip). The wide one is a single slim line.
  if (wide) return (
    <button type="button" onClick={onClick} className={`col-span-5 flex min-w-0 items-baseline gap-2 rounded-xl border px-2.5 py-1.5 text-left active:opacity-80 ${TONES[tone]}`}>
      <span className="shrink-0 text-[12px] text-gray-600">{title}</span>
      <span className="shrink-0 text-[18px] leading-tight text-gray-900">{value}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-gray-500">{sub}</span>
    </button>
  )
  return (
    <button type="button" onClick={onClick} title={typeof sub === 'string' ? sub : undefined} className={`flex min-w-0 flex-col gap-0.5 rounded-xl border px-1.5 py-1.5 text-left active:opacity-80 ${TONES[tone]}`}>
      <span className="line-clamp-2 text-[12px] leading-tight text-gray-600">{title}</span>
      <span className="truncate text-[16px] leading-tight text-gray-900">{value}</span>
    </button>
  )
}

type PTab = { key: string; icon: string; label: string; others: 'all' | 'manage' | 'none' }
const PERSON_TABS: PTab[] = [
  { key: 'waiting', icon: '📋', label: 'Waiting', others: 'manage' },
  { key: 'done', icon: '✔', label: 'Done', others: 'manage' },
  { key: 'laws', icon: '📜', label: 'Laws', others: 'manage' },
  { key: 'times', icon: '🕐', label: 'Times', others: 'all' },
  { key: 'violations', icon: '⚖', label: 'Penalty points', others: 'manage' },
  { key: 'tasks', icon: '✅', label: 'Tasks', others: 'all' },
  { key: 'payslips', icon: '💵', label: 'Payslips', others: 'none' },
  { key: 'profile', icon: '👤', label: 'Profile', others: 'none' },
  { key: 'dressCode', icon: '👕', label: 'Dress code', others: 'all' },
  { key: 'meeting', icon: '🗣️', label: 'Meeting', others: 'all' },
]

// One person's own tabs (Waiting for me, Done, Laws, Times, Penalty points...) as small tiles; each opens that tab of their page.
function PersonTiles({ h, who }: { h: HubCtx; who: string }) {
  // The chosen tab opens right here, under the tiles: no separate page.
  const [tab, setTab] = useState('')
  useEffect(() => { setTab('') }, [who])
  const isSelf = who.toLowerCase() === (h.username ?? '').toLowerCase()
  const may = !!(h.isOwnerOrJoe || h.canManage)
  const tabs = PERSON_TABS.filter(t => isSelf || t.others === 'all' || (t.others === 'manage' && may))
  const w = h.waitingBy?.[who.toLowerCase()]
  if (!who) return null
  return (
    <section aria-label={`${nm(who)}'s pages`} className="space-y-1.5">
      {!isSelf && <h2 className="text-[13px] text-gray-500">{nm(who)}</h2>}
      <div className="grid grid-cols-5 gap-1.5">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(cur => (cur === t.key ? '' : t.key))} aria-pressed={tab === t.key} className={`relative flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-1.5 py-1 text-left active:opacity-80 ${tab === t.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            <span aria-hidden="true" className="text-base leading-none">{t.icon}</span>
            <span className="line-clamp-2 w-full text-[12px] leading-tight text-gray-700">{t.label}</span>
            {t.key === 'waiting' && (w?.total ?? 0) > 0 && <span className={`absolute right-1.5 top-1.5 min-w-[18px] rounded-full px-1 text-center text-[11px] font-semibold leading-[18px] text-white ${w!.now ? 'bg-red-600' : 'bg-amber-500'}`}>{w!.total}</span>}
          </button>
        ))}
      </div>
      {tab && (
        <StaffMemberPersonalTab key={who + tab} hideTabs staffName={who} initialTab={tab as never} username={h.username} role={h.role} canManage={h.canManage} staffRoster={STAFF_ROSTER} routablePages={h.routablePages} categoryIds={h.fixedCategoryIds} />
      )}
    </section>
  )
}

// The Manage page's Team tab: everyone else's profile card; tap one to see that person's tiles and their tabs, right here.
export function HubTeamPanel({ h }: { h: HubCtx }) {
  const [sel, setSel] = useState('')
  const username = h.username
  return (
    <div className="space-y-2 p-3 pb-28">
      <p className="text-[13px] text-gray-500">Tap a person to see their pages.</p>
      <div className="home-team rounded-xl bg-[#00072d] p-1">
        <PresentStaffBar vertical roster={h.activeStaff} selfName={username} onOpenStaff={(name: string) => setSel(name)} onOpenShop={() => h.openShop('home')} activeStaff={sel} shopActive={!!h.shop} waitingBy={h.waitingBy} salesBy={h.salesByStaff} salesTotal={h.liveTapsStatus === 'ok' ? `₵${formatPrice(h.liveTodaySalesTotal)}` : '₵…'} />
      </div>
      <PersonTiles h={h} who={sel} />
    </div>
  )
}

// My shift and my account: clock in or out and take a break (the same panel as the Times tab), then Settings and Sign out.
function MyShift({ h }: { h: HubCtx }) {
  const [mine, setMine] = useState<Mine>(null)
  const [opener, setOpener] = useState<string | null>(null)
  const username = h.username
  useEffect(() => {
    if (!username) return
    fetch('/api/staff-times/today').then(r => (r.ok ? r.json() : null)).then(d => { setMine(d?.mine ?? null); setOpener(d?.opener ?? null) }).catch(() => {})
  }, [username])
  const Tile = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl border border-gray-200 bg-white px-1.5 py-1.5 text-left active:opacity-80">
      <span aria-hidden="true" className="text-lg leading-none">{icon}</span>
      <span className="w-full truncate text-[12px] leading-tight text-gray-700">{label}</span>
    </button>
  )
  const extra = (<>
    {h.canOpenSettings && <Tile icon="⚙️" label="Settings" onClick={() => { h.setShop(null); h.pickLossView('settings') }} />}
    {h.canOpenUkSettings && <Tile icon="🇬🇧" label="UK" onClick={() => { h.setShop(null); h.changeTab('uk'); setTimeout(() => h.setSettingsOpen(true), 50) }} />}
    <Tile icon="🚪" label="Sign out" onClick={() => { if (confirm('Sign out?')) void signOut({ callbackUrl: '/login' }) }} />
  </>)
  return (
    <section aria-label="My shift and account" className="space-y-1.5 sm:hidden">
      {username && <ClockInOutPanel compact compactExtra={extra} username={username} mine={mine} opener={opener} onMineChange={setMine} />}
    </section>
  )
}

// The Home screen (phone): the day at a glance. Everything shown comes from numbers the app already holds, except who is
// clocked in, which is read once when Home opens. Owners, Joe and managers also see cash and flags; staff see their own sales.
export default function HubHome({ h }: { h: HubCtx }) {
  const { username, isOwnerOrJoe, showFlags, liveTodaySalesTotal, liveTaps, liveToday, salesByStaff, myDayBadge, pendingJobsBadge, liveCountProgress,
    liveSaleFlagTotal, salesFlagsCount, billsFlagsCount, cabFlagsCount, lossByDateFlagsCount, staffTimesFlagsCount, dressFlagsCount, expensesFlagsCount, customersFlagsCount, vendorsFlagsCount,
    setShop, openShop, pickLossView, goItemsMode, openEmbed } = h
  const [team, setTeam] = useState<Row[] | null>(null)
  // Only my own card and tiles are on this page; the rest of the team is on the Manage page (Team tab).
  const who = username
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
  // Nobody has clocked in today (once the team has loaded): a day nobody worked asks for no cash count.
  const nobodyIn = team !== null && !team.some(r => r.actual_in)
  // Someone is still clocked in: the day is not over, so no cash count is asked yet.
  const stillIn = clockedIn.length > 0
  const waiting = Number(myDayBadge ?? 0)
  const jobs = Number(pendingJobsBadge ?? 0)
  const countLeft = liveCountProgress ? Math.max(0, liveCountProgress.total - liveCountProgress.doneToday) : null

  // Each card first closes the Home page, then goes where the sidebar's matching button goes.
  const go = (fn: () => void) => () => { setShop(null); fn() }

  return (
    <div className="space-y-2 p-3 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl text-gray-900">{username ? `${hello}, ${nm(username)}` : hello}</h1>
          <p className="text-sm text-gray-500">{dateText}</p>
        </div>
        {/* My own picture (phones; computers have it in the top bar). The rest of the team is on the Manage page. */}
        {username && <div className="sm:hidden"><MySelfChip name={nm(username)} username={username} sales={mySales} bare onSelect={() => undefined} /></div>}
      </div>
      <PersonTiles h={h} who={who} />
      <MyShift h={h} />
      <div className="grid grid-cols-5 gap-1.5">
        {showFlags ? (
          <Card wide title="Sales today" onClick={go(() => goItemsMode('log'))} value={<MoneyText v={Number(liveTodaySalesTotal)} />}
            sub={`${todayTaps.length} sale${todayTaps.length === 1 ? '' : 's'} recorded · you ${mySales.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`} />
        ) : (
          <Card wide title="Your sales today" onClick={go(() => goItemsMode('log'))} value={<MoneyText v={mySales} />} sub={`Shop total ${Number(liveTodaySalesTotal).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`} />
        )}
        <Card title="Daily summary" value="Open" tone="plain" sub="Today's sales and flags in one page" onClick={go(() => h.setLossView('dailySummary'))} />
        <Card title="Pending jobs" value={jobs} tone={jobs > 0 ? 'plain' : 'good'} sub={jobs > 0 ? 'Customers’ work left with us' : 'None open'} onClick={() => openEmbed('/pending-jobs')} />
        {showFlags && (
          <Card title="Cash counted" tone={cash !== null ? 'good' : (nobodyIn || stillIn ? 'plain' : new Date().getHours() >= 18 ? 'bad' : 'plain')} onClick={go(() => goItemsMode('log'))}
            value={cash === null ? (nobodyIn ? '–' : stillIn ? 'Later' : 'Not yet') : <MoneyText v={cash} />} sub={cash === null ? (nobodyIn ? 'Nobody clocked in today, so nothing to count' : stillIn ? 'Count it once everyone has clocked out' : 'Count it in the Sales Log before closing') : 'Entered for today'} />
        )}
        {showFlags && (
          <Card title="Flags" value={flagTotal} tone={flagTotal > 0 ? 'warn' : 'good'} sub={flagTotal > 0 ? 'Things to fix' : 'All clear'} onClick={go(() => pickLossView('flags'))} />
        )}
        <Card title="Counts to do" value={countLeft ?? '–'} tone={countLeft ? 'warn' : 'plain'} sub={liveCountProgress ? `${liveCountProgress.doneToday} of ${liveCountProgress.total} counted today` : 'Loading…'} onClick={go(() => pickLossView('counts'))} />
        <Card title="Team" value={team === null ? '–' : clockedIn.length} tone="plain" onClick={() => openShop('times')}
          sub={team === null ? 'Loading…' : clockedIn.length ? clockedIn.map(r => nm(r.staff_name)).join(', ') : 'Nobody clocked in yet'} />
        <HubRecord h={h} embedded />
      </div>
    </div>
  )
}
