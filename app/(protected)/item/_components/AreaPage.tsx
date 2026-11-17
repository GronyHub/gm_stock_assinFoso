'use client'
import { useEffect, useState } from 'react'
import ManageLogPanel from './ManageLogPanel'
import { fmtDate } from '@/lib/fmtDate'

type Point = { id: number; staff: string; points: number; reason: string; day: string; status: string; law_code: string | null; law_title: string | null }
type Done = { tile_id: number; title: string; day: string; recorded_by: string; value: string }
type Record_ = { days: number; all: boolean; people: Record<string, { points: number; done: number }>; points: Point[]; done: Done[] }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// One area of the shop on one page, with three sections: the laws that govern it (Rules), how they were kept (How it went:
// duties recorded and penalty points) and a place for staff to write something about it (Record). The same area key
// as the Laws page tile, so the Laws page and this page always show the same laws.
export default function AreaPage({ areaKey, label, icon, logCategory }: { areaKey: string; label: string; icon: string; logCategory: string }) {
  const [tab, setTab] = useState<'rules' | 'went' | 'record'>('record')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Record_ | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (tab !== 'went') return
    setData(null); setFailed(false)
    fetch(`/api/area-record?area=${areaKey}&days=${days}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true))
  }, [tab, days, areaKey])

  const people = data ? Object.entries(data.people).sort((a, b) => b[1].points - a[1].points || b[1].done - a[1].done) : []

  return (
    <div>
      <div role="tablist" className="mb-2 flex gap-1.5">
        {([['rules', '📜 Rules'], ['went', '📊 How it went'], ['record', '✍️ Record']] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t}</button>
        ))}
      </div>

      {tab === 'rules' && <iframe src={`/laws?tile=${areaKey}`} title={`${label} laws`} className="h-[72vh] w-full rounded-lg border border-gray-200" />}

      {tab === 'record' && <ManageLogPanel category={logCategory} label={label} icon={icon} />}

      {tab === 'went' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            {[7, 30, 90].map(d => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${days === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{d} days</button>)}
          </div>
          {failed && <p className="py-6 text-center text-sm text-red-600">Could not load. Try again.</p>}
          {!data && !failed && <p className="py-6 text-center text-sm text-gray-400">Loading…</p>}
          {data && (<>
            <p className="text-[12px] text-gray-500">{data.all ? 'Everyone, last' : 'Only you, last'} {data.days} days.</p>
            {people.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">Nothing recorded for {label} in this time.</p> : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] font-semibold uppercase text-gray-500"><span>Staff</span><span className="text-right">Done</span><span className="text-right">Penalty points</span></div>
                {people.map(([n, v]) => (
                  <div key={n} className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-gray-100 px-3 py-2 text-[14px] last:border-0">
                    <span className="text-gray-900">{cap(n)}</span>
                    <span className="text-right tabular-nums text-green-700">{v.done}</span>
                    <span className={`text-right tabular-nums ${v.points ? 'font-semibold text-red-700' : 'text-gray-400'}`}>{v.points}</span>
                  </div>
                ))}
              </div>
            )}
            {data.points.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-gray-800">Not kept (penalty points)</p>
                <ul className="space-y-1.5">
                  {data.points.map(p => (
                    <li key={p.id} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-gray-900">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{cap(p.staff)} · {fmtDate(p.day)}</span><span className="font-bold text-red-700">{p.points} pt{p.points === 1 ? '' : 's'}</span></div>
                      <p className="text-gray-700">{p.law_code ? `${p.law_code}: ` : ''}{p.law_title ?? p.reason}</p>
                      {p.status === 'pending' && <p className="text-[12px] text-amber-700">Waiting for a decision</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.done.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-gray-800">Done</p>
                <ul className="space-y-1">
                  {data.done.slice(0, 60).map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-[13px] text-gray-800 ring-1 ring-gray-200">
                      <span className="min-w-0 truncate">{d.title}</span><span className="shrink-0 text-gray-500">{cap(d.recorded_by)} · {fmtDate(d.day)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>)}
        </div>
      )}
    </div>
  )
}
