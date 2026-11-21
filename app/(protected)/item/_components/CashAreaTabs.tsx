'use client'
import { useEffect, useState, type ReactNode } from 'react'

// Each Cash page is one law area: the page itself, then its laws (Rules), what was done (Done) and what was missed (Not done).
// The same three things the Manage pages have, minus Record.

type Tab = 'page' | 'rules' | 'done' | 'missed'
type Done = { title: string; day: string; recorded_by: string; value: string; note: string | null }
type Missed = { day: string; title: string; owner: string | null; reason: string | null; state: string }

const LOSS_AREAS: Record<string, [string, string]> = {
  items: ['items', 'Live'],
  customers: ['customers', 'Customers'],
  vendors: ['vendors', 'Vendors'],
  purchaseOrders: ['po', 'Purchase Orders'],
  counts: ['counts', 'Counts'],
  item360: ['item360', 'Item 360'],
  cab: ['cab', 'CAB'],
}

// Which law area a Cash view belongs to, or null when the view is not a law area (Home, Flags, Services...).
export function cashAreaFor(lossView: string, liveMode: string | undefined, plSubView: string | undefined): { key: string; label: string } | null {
  if (liveMode === 'log') return { key: 'log', label: 'Sales Log' }
  if (liveMode === 'bills') return { key: 'bills', label: 'Bills' }
  if (liveMode === 'expenses') return { key: 'expenses', label: 'Expenses' }
  if (lossView === 'pl') return plSubView && plSubView !== 'pl' ? { key: 'losses', label: 'Losses & Analytics' } : { key: 'pl', label: 'P&L' }
  const m = LOSS_AREAS[lossView]
  return m ? { key: m[0], label: m[1] } : null
}

export default function CashAreaTabs({ areaKey, label, children }: { areaKey: string | null; label: string; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('page')
  const [rec, setRec] = useState<{ done: Done[]; missed: Missed[] } | null>(null)

  // A different Cash page starts on its own page, with nothing fetched yet.
  useEffect(() => { setTab('page'); setRec(null) }, [areaKey])
  useEffect(() => {
    if (!areaKey || rec || (tab !== 'done' && tab !== 'missed')) return
    fetch(`/api/area-record?area=${encodeURIComponent(areaKey)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRec({ done: Array.isArray(d.done) ? d.done : [], missed: Array.isArray(d.missed) ? d.missed : [] }))
      .catch(() => setRec({ done: [], missed: [] }))
  }, [tab, areaKey, rec])

  if (!areaKey) return <>{children}</>

  const tabs: [Tab, string][] = [['page', label], ['rules', '📜 Rules'], ['done', '✅ Done'], ['missed', '⚠️ Not done']]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto px-2 py-1.5">
        {tabs.map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-bold ${tab === k ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'page' && <div className="flex min-h-0 flex-1 flex-col">{children}</div>}
      {tab === 'rules' && <iframe key={areaKey} src={`/laws?tile=${encodeURIComponent(areaKey)}&embed=1`} title={`${label} laws`} className="min-h-[70vh] w-full flex-1 border-0" />}
      {tab === 'done' && (
        <div className="space-y-2 overflow-y-auto p-3">
          {!rec ? <p className="text-sm text-gray-400">Loading…</p>
            : rec.done.length === 0 ? <p className="text-sm text-gray-500">Nothing recorded as done in the last 30 days.</p>
            : rec.done.map((d, i) => (
              <div key={i} className="rounded-xl border border-green-300 bg-green-50 px-3 py-2">
                <p className="text-[12px] font-bold text-gray-500">{d.day} · <span className="capitalize">{d.recorded_by}</span></p>
                <p className="text-[14px] font-semibold text-gray-900">{d.title}</p>
                {d.note && <p className="text-[13px] text-gray-700">{d.note}</p>}
              </div>
            ))}
        </div>
      )}
      {tab === 'missed' && (
        <div className="space-y-2 overflow-y-auto p-3">
          {!rec ? <p className="text-sm text-gray-400">Loading…</p>
            : rec.missed.length === 0 ? <p className="text-sm text-gray-500">Nothing missed in the last 30 days.</p>
            : rec.missed.map((m, i) => (
              <div key={i} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2">
                <p className="text-[12px] font-bold text-gray-500">{m.day}{m.owner ? ` · ${m.owner}` : ''}</p>
                <p className="text-[14px] font-semibold text-gray-900">{m.title}</p>
                {m.reason && <p className="text-[13px] text-gray-700">Reason: {m.reason}</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
