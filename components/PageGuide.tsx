'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { areaForGuide } from '@/lib/lawAreas'

// The Laws page of a Cash page: a sheet over the page with the page's laws (Rules), what was done (Done) and what was missed (Not done).
// The Cash page itself carries no such tabs; they live here, behind its "📜 Laws" button.

type Tab = 'rules' | 'done' | 'missed'
type Done = { title: string; day: string; recorded_by: string; value: string; note: string | null }
type Missed = { day: string; title: string; owner: string | null; reason: string | null; state: string }

export function LawsSheet({ areaKey, label, onClose }: { areaKey: string; label: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('rules')
  const [rec, setRec] = useState<{ done: Done[]; missed: Missed[] } | null>(null)

  useEffect(() => {
    if (tab === 'rules' || rec) return
    fetch(`/api/area-record?area=${encodeURIComponent(areaKey)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRec({ done: Array.isArray(d.done) ? d.done : [], missed: Array.isArray(d.missed) ? d.missed : [] }))
      .catch(() => setRec({ done: [], missed: [] }))
  }, [tab, areaKey, rec])

  if (typeof document === 'undefined') return null
  const tabs: [Tab, string][] = [['rules', '📜 Rules'], ['done', '✅ Done'], ['missed', '⚠️ Not done']]
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <p className="min-w-0 truncate text-[15px] font-bold text-[#14213D]">📜 {label} laws</p>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-bold text-gray-700">Close</button>
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto px-2 py-1.5">
        {tabs.map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-bold ${tab === k ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'rules' && <iframe key={areaKey} src={`/laws?tile=${encodeURIComponent(areaKey)}&embed=1`} title={`${label} laws`} className="min-h-0 w-full flex-1 border-0" />}
      {tab === 'done' && (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
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
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
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
    </div>,
    document.body)
}

// The "📜 Laws" button on a Cash page.
export default function PageGuide({ page }: { page: string }) {
  const area = areaForGuide(page)
  const [open, setOpen] = useState(false)
  if (!area) return null
  return (<>
    <button type="button" onClick={() => setOpen(true)} title={`The laws, sanctions and how-to for ${area.label}`}
      className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[12px] font-bold text-indigo-700 hover:bg-indigo-100">📜 Laws</button>
    {open && <LawsSheet areaKey={area.key} label={area.label} onClose={() => setOpen(false)} />}
  </>)
}
