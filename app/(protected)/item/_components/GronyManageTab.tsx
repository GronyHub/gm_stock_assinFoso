'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useViolations } from './useViolations'
import { ViolationRow } from './ViolationRow'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'

const ExpensesTab = dynamic(() => import('./ExpensesTab'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

type ManageView =
  | 'flags' | 'advert' | 'staff_dress' | 'properties'
  | 'arrangement' | 'cleanliness' | 'future' | 'customer_display'
  | 'staff_display' | 'training' | 'repair_works' | 'quality_assurance'

// Simple dated log/checklist categories -- no existing data behind them, so
// each gets a ManageLogPanel (notes + optional photo, viewable as history).
const LOG_CATEGORIES: { key: ManageView; label: string; icon: string }[] = [
  { key: 'arrangement',      label: 'Arrangement',       icon: '🪑' },
  { key: 'cleanliness',      label: 'Cleanliness',       icon: '🧹' },
  { key: 'future',           label: 'Future',            icon: '🔭' },
  { key: 'customer_display', label: 'Customer Display',  icon: '🖼️' },
  { key: 'staff_display',    label: 'Staff Display',     icon: '📌' },
  { key: 'training',         label: 'Training',          icon: '🎓' },
  { key: 'repair_works',     label: 'Repair Works',      icon: '🔧' },
  { key: 'quality_assurance', label: 'Quality Assurance', icon: '✅' },
]

const SUBMENU: { key: ManageView; label: string }[] = [
  { key: 'flags', label: '🚩 Flags' },
  { key: 'advert', label: '📢 Advert' },
  { key: 'staff_dress', label: '👕 Staff' },
  { key: 'properties', label: '🏷️ Properties' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: `${c.icon} ${c.label}` })),
]

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (staff times, count duties, item hygiene, and now the
// shop's day-to-day operational checklist categories).
export default function GronyManageTab({ onGoToViolation, counts }: {
  onGoToViolation?: (key: string) => void
  counts?: Record<string, number>
}) {
  const [view, setView] = useState<ManageView>('flags')
  const { flags, assignments, deadlines, assignedBy, assignedOn, vSettings, manageViolations, manageCount } = useViolations(counts)

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border-b border-blue-100 overflow-x-auto shrink-0">
        {SUBMENU.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
              ${view === v.key ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
            {v.label}
            {v.key === 'flags' && manageCount > 0 && (
              <span className={`ml-1 text-[10px] font-bold rounded-full px-1.5 leading-tight ${view === 'flags' ? 'bg-white/25 text-white' : 'bg-red-600 text-white'}`}>
                {manageCount > 99 ? '99+' : manageCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'flags' && (
          <div className="py-2 px-2 space-y-1.5">
            <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  🗂️ Grony Manage Flags {manageCount > 0 && <span className="text-red-500">🚩{manageCount}</span>}
                </p>
              </div>
              {!flags ? (
                <p className="text-[11px] text-gray-400 py-[1px]">Loading…</p>
              ) : (
                <div>
                  {manageViolations.map(v => (
                    <ViolationRow key={v.type} v={v} assignments={assignments} deadlines={deadlines}
                      assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                      onGoToViolation={onGoToViolation} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'advert' && <ClosingReportLogView field="advert_played" label="Advert" icon="📢" />}
        {view === 'staff_dress' && <ClosingReportLogView field="no_tshirt_staff" label="Staff" icon="👕" />}
        {view === 'properties' && <ExpensesTab search="" initialTab="properties" />}
        {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
      </div>
    </div>
  )
}
