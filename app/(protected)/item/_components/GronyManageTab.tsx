'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import TrainingTab from './TrainingTab'
import AdvertTab from './AdvertTab'

const ExpensesTab = dynamic(() => import('./ExpensesTab'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const StaffClient = dynamic(() => import('../../staff/StaffClient'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const LogsPage = dynamic(() => import('../../logs/page'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

export type ManageView =
  | 'staff_times' | 'advert' | 'staff_dress' | 'properties'
  | 'arrangement' | 'cleanliness' | 'future' | 'customer_display'
  | 'staff_display' | 'training' | 'repair_works' | 'quality_assurance' | 'logs'

// Simple dated log/checklist categories -- no existing data behind them, so
// each gets a ManageLogPanel (notes + optional photo, viewable as history).
// Training gets its own richer sub-tabs (Tutorial/Laws/Assessment) instead.
const LOG_CATEGORIES: { key: ManageView; label: string; icon: string }[] = [
  { key: 'arrangement',      label: 'Arrangement',       icon: '🪑' },
  { key: 'cleanliness',      label: 'Cleanliness',       icon: '🧹' },
  { key: 'future',           label: 'Future',            icon: '🔭' },
  { key: 'customer_display', label: 'Customer Display',  icon: '🖼️' },
  { key: 'staff_display',    label: 'Staff Display',     icon: '📌' },
  { key: 'repair_works',     label: 'Repair Works',      icon: '🔧' },
  { key: 'quality_assurance', label: 'Quality Assurance', icon: '✅' },
]

const SUBMENU: { key: ManageView; label: string }[] = [
  { key: 'staff_times', label: 'Staff' },
  { key: 'advert', label: 'Advert' },
  { key: 'staff_dress', label: 'Dress Code' },
  { key: 'properties', label: 'Properties' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label })),
  { key: 'training', label: 'Training' },
  { key: 'logs', label: 'Logs' },
]

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (staff times, count duties, item hygiene, and now the
// shop's day-to-day operational checklist categories).
export default function GronyManageTab() {
  const [view, setView] = useState<ManageView>('staff_times')
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {SUBMENU.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap transition
              ${view === v.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'staff_times' && <StaffClient role={role} username={username} embedded />}
        {view === 'advert' && <AdvertTab />}
        {view === 'staff_dress' && <ClosingReportLogView field="no_tshirt_staff" label="Dress Code" icon="👕" />}
        {view === 'properties' && <ExpensesTab search="" propertiesOnly />}
        {view === 'training' && <TrainingTab />}
        {view === 'logs' && <div className="px-2"><LogsPage /></div>}
        {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
      </div>
    </div>
  )
}
