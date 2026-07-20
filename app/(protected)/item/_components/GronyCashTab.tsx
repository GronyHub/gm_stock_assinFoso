'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePolling } from '@/lib/usePolling'
import { useViolations, DEFAULT_ASSIGNEE } from './useViolations'
import { ViolationRow } from './ViolationRow'

// Moved here from the Home page's "💰 Grony Cash" submenu -- everything that
// touches money directly now lives under the Grony Cash tab instead of being
// split between Home and a hamburger menu.
export default function GronyCashTab({ onGoToViolation, counts }: {
  onGoToViolation?: (key: string) => void
  counts?: Record<string, number>
}) {
  const { flags, assignments, deadlines, assignedBy, assignedOn, vSettings, cashViolations, cashCount } = useViolations(counts)
  const [lossEvents, setLossEvents] = useState<{ date: string; loss_amt: number }[] | null>(null)

  function loadLossEvents() {
    fetch('/api/losses/events')
      .then(r => r.ok ? r.json() : [])
      .then(d => setLossEvents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  useEffect(() => { loadLossEvents() }, [])
  usePolling(loadLossEvents, 60000)

  // Loss-feed summaries for Joe: all-time, yesterday, this week (Mon-start),
  // this month, this year. Amounts use the Loss menu's valuation.
  const lossSummary = useMemo(() => {
    if (!lossEvents) return null
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const y = new Date(today); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - ((today.getDay() + 6) % 7))
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today.getFullYear()}-01-01`
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

  return (
    <div className="py-2 px-2 space-y-1.5">
      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            💰 Grony Cash Flags {cashCount > 0 && <span className="text-red-500">🚩{cashCount}</span>}
          </p>
          <Link href="/staff?tab=Assignments" className="text-[10px] text-blue-600 font-semibold">
            Assign →
          </Link>
        </div>
        {/* Loss-feed summaries for Joe — all figures from the 🔻 Loss menu */}
        {lossSummary && (() => {
          const cedis = (v: number) => `₵${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          const who = <span className="capitalize font-semibold">{DEFAULT_ASSIGNEE}</span>
          const fixNow = (
            <button onClick={() => onGoToViolation?.('__loss_feed')} className="text-blue-600 font-semibold whitespace-nowrap">
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
        {!flags ? (
          <p className="text-[11px] text-gray-400 py-[1px]">Loading…</p>
        ) : (
          <div>
            {cashViolations.map(v => (
              <ViolationRow key={v.type} v={v} assignments={assignments} deadlines={deadlines}
                assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                onGoToViolation={onGoToViolation} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
