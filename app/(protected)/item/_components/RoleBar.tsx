'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'
import { ViolationRow } from './ViolationRow'
import { DEFAULT_ASSIGNEE, MANAGE_DEFAULT_ASSIGNEE, type Violation } from './useViolations'

type TodayInfo = { opener: string | null; openerConfirmed: boolean | null }

type Props = {
  cashViolations: Violation[]
  manageViolations: Violation[]
  cashCount: number
  manageCount: number
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation: (key: string) => void
  missingClosingReportsCount: number
  onOpenManage: () => void
}

type RoleKey = 'joe' | 'bino' | 'opener' | 'closer'

// Persistent bottom bar -- one tab per role player (Joe/cash, Bino/manage,
// today's Opener, today's Closer) with a red badge for outstanding issues.
// Tapping opens that role's flagged items, so a skipped mandatory task (the
// Opener's count confirmation, the Closer's closing report) is always one
// tap away, not just at the moment it's due.
export default function RoleBar({
  cashViolations, manageViolations, cashCount, manageCount,
  assignments, deadlines, assignedBy, assignedOn, vSettings,
  onGoToViolation, missingClosingReportsCount, onOpenManage,
}: Props) {
  const [openRole, setOpenRole] = useState<RoleKey | null>(null)
  const [today, setToday] = useState<TodayInfo>({ opener: null, openerConfirmed: null })

  function load() {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null }) })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])
  usePolling(load, 30000)

  // Loss-feed summaries for Joe -- all-time, yesterday, this week (Mon-start),
  // this month, this year. Amounts use the Loss menu's valuation. Only
  // fetched once the Joe panel is actually open.
  const [lossEvents, setLossEvents] = useState<{ date: string; loss_amt: number }[] | null>(null)
  useEffect(() => {
    if (openRole !== 'joe') return
    fetch('/api/losses/events')
      .then(r => r.ok ? r.json() : [])
      .then(d => setLossEvents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [openRole])

  const lossSummary = useMemo(() => {
    if (!lossEvents) return null
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const y = new Date(today0); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today0); weekStart.setDate(weekStart.getDate() - ((today0.getDay() + 6) % 7))
    const monthStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today0.getFullYear()}-01-01`
    const yesterday = fmtLocal(y), ws = fmtLocal(weekStart)
    const agg = (pred: (d: string) => boolean) => {
      const list = lossEvents.filter(e => pred(e.date))
      return { n: list.length, amt: parseFloat(list.reduce((s, e) => s + (Number(e.loss_amt) || 0), 0).toFixed(2)) }
    }
    return {
      total: agg(() => true),
      yesterday: agg(d => d === yesterday),
      week: agg(d => d >= ws),
      month: agg(d => d >= monthStart),
      year: agg(d => d >= yearStart),
    }
  }, [lossEvents])

  const openerCount = today.opener && !today.openerConfirmed ? 1 : 0
  const closerCount = missingClosingReportsCount

  const TABS: { key: RoleKey; label: string; count: number }[] = [
    { key: 'joe', label: 'Joe', count: cashCount },
    { key: 'bino', label: 'Bino', count: manageCount },
    { key: 'opener', label: 'Opener', count: openerCount },
    { key: 'closer', label: 'Closer', count: closerCount },
  ]

  function goManage() {
    setOpenRole(null)
    onOpenManage()
  }

  return (
    <>
      <div className="shrink-0 flex items-stretch bg-white border-t border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setOpenRole(t.key)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition">
            {t.label}
            {t.count > 0 && (
              <span className="text-[10px] font-bold rounded-full px-1.5 leading-tight bg-red-600 text-white">
                {t.count > 99 ? '99+' : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {openRole && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80dvh] overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900 text-base capitalize">{openRole}</p>
              <button onClick={() => setOpenRole(null)} className="text-gray-300 hover:text-gray-600 font-bold leading-none text-xl">×</button>
            </div>

            {openRole === 'joe' && (
              <>
                {/* Loss-feed summaries — all figures from the 🔻 Loss menu */}
                {lossSummary && (() => {
                  const cedis = (v: number) => `₵${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  const who = <span className="capitalize font-semibold">{DEFAULT_ASSIGNEE}</span>
                  const fixNow = (
                    <button onClick={() => { setOpenRole(null); onGoToViolation('__loss_feed') }} className="text-blue-600 font-semibold whitespace-nowrap">
                      Fix now →
                    </button>
                  )
                  const R = ({ children, active }: { children: React.ReactNode; active: boolean }) => (
                    <div className={`py-[3px] text-[11px] leading-snug ${active ? 'text-gray-700' : 'text-gray-400'}`}>{children}</div>
                  )
                  const B = ({ v }: { v: string | number }) => <span className="font-bold text-red-500">{v}</span>
                  const t = lossSummary
                  return (
                    <div className="border-b border-gray-100 pb-1 mb-1">
                      <R active={t.total.n > 0}>
                        {t.total.n > 0 ? (
                          <>{who}, there are <B v={t.total.n} /> losses detected amounting to a loss of <B v={cedis(t.total.amt)} /> — fix them now or you will pay it (it will be deducted from your salary). {fixNow}</>
                        ) : (
                          <>{who}, no losses on record <span className="text-green-600">✓</span></>
                        )}
                      </R>
                      <R active={t.yesterday.n > 0}>
                        {t.yesterday.n > 0 ? (
                          <>{who}, there was a loss of <B v={cedis(t.yesterday.amt)} /> ({t.yesterday.n} item{t.yesterday.n !== 1 ? 's' : ''}) from yesterday. {fixNow}</>
                        ) : (
                          <>{who}, no loss from yesterday <span className="text-green-600">✓</span></>
                        )}
                      </R>
                      <R active={t.week.n > 0}>
                        {t.week.n > 0 ? (
                          <>{who}, there have been <B v={t.week.n} /> losses this week (<B v={cedis(t.week.amt)} />) — investigate and fix now. {fixNow}</>
                        ) : (
                          <>{who}, no losses this week <span className="text-green-600">✓</span></>
                        )}
                      </R>
                      <R active={t.month.n > 0}>
                        {t.month.n > 0 ? (
                          <>{who}, <B v={t.month.n} /> losses this month (<B v={cedis(t.month.amt)} />) — investigate and fix now. {fixNow}</>
                        ) : (
                          <>{who}, no losses this month <span className="text-green-600">✓</span></>
                        )}
                      </R>
                      <R active={t.year.n > 0}>
                        {t.year.n > 0 ? (
                          <>{who}, <B v={t.year.n} /> losses this year (<B v={cedis(t.year.amt)} />) — investigate and fix now. {fixNow}</>
                        ) : (
                          <>{who}, no losses this year <span className="text-green-600">✓</span></>
                        )}
                      </R>
                    </div>
                  )
                })()}
                {cashViolations.filter(v => v.count > 0).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">Nothing outstanding for Joe ✓</p>
                ) : (
                  cashViolations.map(v => (
                    <ViolationRow key={v.type} v={v} assignments={assignments} deadlines={deadlines}
                      assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                      onGoToViolation={key => { setOpenRole(null); onGoToViolation(key) }} defaultAssignee={DEFAULT_ASSIGNEE} />
                  ))
                )}
              </>
            )}
            {openRole === 'bino' && (
              manageViolations.filter(v => v.count > 0).length === 0 ? (
                <p className="text-sm text-gray-400 py-4">Nothing outstanding for Bino ✓</p>
              ) : (
                manageViolations.map(v => (
                  <ViolationRow key={v.type} v={v} assignments={assignments} deadlines={deadlines}
                    assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                    onGoToViolation={key => { setOpenRole(null); onGoToViolation(key) }} defaultAssignee={MANAGE_DEFAULT_ASSIGNEE} />
                ))
              )
            )}
            {openRole === 'opener' && (
              openerCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    🌅 <span className="capitalize font-semibold">{today.opener}</span>, take today&apos;s opening count now to finish your clock-in.
                  </p>
                  <button onClick={goManage}
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition">
                    Go to Staff →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-4">
                  {today.opener
                    ? <>✓ <span className="capitalize">{today.opener}</span> has confirmed today&apos;s opening count.</>
                    : 'Nobody has clocked in yet today.'}
                </p>
              )
            )}
            {openRole === 'closer' && (
              closerCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    🌙 The closing report was missed on {closerCount} past day{closerCount !== 1 ? 's' : ''}.
                  </p>
                  <button onClick={goManage}
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition">
                    Go to Staff →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-4">✓ Every day has a closing report.</p>
              )
            )}
          </div>
        </div>
      )}
    </>
  )
}
