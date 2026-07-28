'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import TrainingTab from './TrainingTab'
import AdvertTab from './AdvertTab'

// Staff (Times/Payslips/Violations/Role/Analytics/Assignments) moved to its
// own top-level "Staff" tab, one per person -- see item/page.tsx. Rota stays
// here since it's a shared weekly schedule across everyone, not one
// person's record.
const RotaTab = dynamic(() => import('../../staff/StaffClient').then(m => ({ default: m.RotaTab })), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const LogsPage = dynamic(() => import('../../logs/page'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

export type ManageView =
  | 'rota' | 'advert' | 'staff_dress'
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

// Grouped under one "Shop Beautification" submenu instead of four separate
// top-level pills -- Arrangement/Cleanliness/Customer Display/Staff Display
// are all "how the shop looks" checklists, distinct from Repair Works/
// Quality Assurance/Future which stay as their own top-level items.
const SHOP_BEAUTIFICATION: ManageView[] = ['arrangement', 'cleanliness', 'customer_display', 'staff_display']

const SUBMENU: { key: ManageView | 'shop_beautification'; label: string }[] = [
  { key: 'advert', label: 'Advert' },
  { key: 'staff_dress', label: 'Dress Code' },
  { key: 'shop_beautification', label: 'Shop Beautification' },
  ...LOG_CATEGORIES.filter(c => !SHOP_BEAUTIFICATION.includes(c.key)).map(c => ({ key: c.key, label: c.label })),
  { key: 'rota', label: 'Rota' },
  { key: 'training', label: 'Training' },
  { key: 'logs', label: 'Logs' },
]

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (count duties, item hygiene, shift scheduling, and the
// shop's day-to-day operational checklist categories).
export default function GronyManageTab({ initialView }: { initialView?: ManageView } = {}) {
  const [view, setView] = useState<ManageView>(initialView ?? 'advert')

  // Driven by the global search (page.tsx) landing here already knowing
  // which sub-tab to show -- also covers re-arriving at a different one
  // while this page is already mounted, not just the first mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialView) setView(initialView)
  }, [initialView])

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)
  const inShopBeautification = SHOP_BEAUTIFICATION.includes(view)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {SUBMENU.map(v => {
          const active = v.key === 'shop_beautification' ? inShopBeautification : view === v.key
          return (
            <button key={v.key}
              onClick={() => setView(v.key === 'shop_beautification' ? 'arrangement' : v.key)}
              className={`shrink-0 text-sm font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border transition
                ${active ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
              {v.label}
            </button>
          )
        })}
      </div>

      {inShopBeautification && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border-b border-gray-100 overflow-x-auto shrink-0">
          {LOG_CATEGORIES.filter(c => SHOP_BEAUTIFICATION.includes(c.key)).map(c => (
            <button key={c.key} onClick={() => setView(c.key)}
              className={`shrink-0 text-[13px] font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border transition
                ${view === c.key ? 'bg-blue-500 text-white border-blue-500' : 'text-gray-400 border-gray-200 hover:bg-gray-100'}`}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'rota' && <div className="px-2"><RotaTab /></div>}
        {view === 'advert' && <AdvertTab />}
        {view === 'staff_dress' && <ClosingReportLogView field="no_tshirt_staff" label="Dress Code" icon="👕" />}
        {view === 'training' && <TrainingTab />}
        {view === 'logs' && <div className="px-2"><LogsPage /></div>}
        {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
      </div>
    </div>
  )
}
