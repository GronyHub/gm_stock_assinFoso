'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import AdvertStatusPanel from './AdvertStatusPanel'
import AssessmentPanel from './AssessmentPanel'
import DynamicCategoryPage from './DynamicCategoryPage'

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

// Advert and Training used to each hold their own sub-tabs (nested one
// level deeper, e.g. Advert > WhatsApp) -- now flattened into this same
// list alongside everything else, same treatment Shop Beautification's
// children already got. No more nested tab bars inside the right pane.
export type ManageView =
  | 'rota'
  | 'audio' | 'audio_status' | 'jingle' | 'equipment' | 'photoshop' | 'whatsapp' | 'cuttings' | 'video' | 'advert_log'
  | 'staff_dress'
  | 'arrangement' | 'cleanliness' | 'future' | 'customer_display'
  | 'staff_display' | 'repair_works' | 'quality_assurance'
  | 'tutorial' | 'training_laws' | 'assessment'
  | 'logs'

// Simple dated log/checklist categories -- no existing data behind them, so
// each gets a ManageLogPanel (notes + optional photo, viewable as history).
const LOG_CATEGORIES: { key: ManageView; label: string; icon: string }[] = [
  { key: 'arrangement',      label: 'Arrangement',       icon: '🪑' },
  { key: 'cleanliness',      label: 'Cleanliness',       icon: '🧹' },
  { key: 'future',           label: 'Future',            icon: '🔭' },
  { key: 'customer_display', label: 'Customer Display',  icon: '🖼️' },
  { key: 'staff_display',    label: 'Staff Display',     icon: '📌' },
  { key: 'repair_works',     label: 'Repair Works',      icon: '🔧' },
  { key: 'quality_assurance', label: 'Quality Assurance', icon: '✅' },
]

// The left pane's fixed contents, top to bottom -- one flat list, no nested
// groups and no nested tab bars within any single item's own content.
const LIST_ITEMS: { key: ManageView; label: string; icon?: string }[] = [
  { key: 'audio', label: 'Audio', icon: '🎙️' },
  { key: 'audio_status', label: 'Advert Status', icon: '📋' },
  { key: 'jingle', label: 'Jingle Log', icon: '🎵' },
  { key: 'equipment', label: 'Equipment Check', icon: '🔊' },
  { key: 'photoshop', label: 'Photoshop', icon: '🖌️' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { key: 'cuttings', label: 'Cuttings', icon: '✂️' },
  { key: 'video', label: 'Video', icon: '🎬' },
  { key: 'advert_log', label: 'Daily Log', icon: '📢' },
  { key: 'staff_dress', label: 'Dress Code' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon })),
  { key: 'tutorial', label: 'Tutorial', icon: '📖' },
  { key: 'training_laws', label: 'Company Laws', icon: '⚖️' },
  { key: 'assessment', label: 'Assessment', icon: '📝' },
  { key: 'rota', label: 'Rota' },
  { key: 'logs', label: 'Logs' },
]

type DynamicCategory = { id: number; label: string }

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (count duties, item hygiene, shift scheduling, and the
// shop's day-to-day operational checklist categories).
export default function GronyManageTab({ initialView, role, username }: { initialView?: ManageView; role: string; username: string }) {
  const [view, setView] = useState<ManageView>(initialView ?? 'audio')
  // User-added categories (see manage-categories) -- listed after the fixed
  // ones. Selecting one is a separate mode from `view` above (null = a fixed
  // category is active) rather than folding into the ManageView union,
  // since these ids are open-ended, not a fixed set.
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([])
  const [activeDynamicId, setActiveDynamicId] = useState<number | null>(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  // Same gate throughout this file -- Rota's edit controls, and adding/
  // removing a category or one of its tabs, are all owner-level only.
  // Viewing is open to everyone.
  const canManage = role === 'owner' || ['joe', 'grony'].includes(username.toLowerCase())

  function loadDynamicCategories() {
    fetch('/api/manage-categories').then(r => r.ok ? r.json() : []).then(d => {
      setDynamicCategories(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }
  useEffect(() => { loadDynamicCategories() }, [])

  // Driven by the global search (page.tsx) landing here already knowing
  // which sub-tab to show -- also covers re-arriving at a different one
  // while this page is already mounted, not just the first mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialView) { setView(initialView); setActiveDynamicId(null) }
  }, [initialView])

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)
  const activeDynamic = dynamicCategories.find(c => c.id === activeDynamicId)

  function pick(key: ManageView) {
    setView(key)
    setActiveDynamicId(null)
  }
  function pickDynamic(id: number) {
    setActiveDynamicId(id)
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryLabel.trim() || savingCategory) return
    setSavingCategory(true)
    const res = await fetch('/api/manage-categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newCategoryLabel.trim() }),
    })
    setSavingCategory(false)
    if (res.ok) {
      const row = await res.json()
      setNewCategoryLabel(''); setShowAddCategory(false)
      loadDynamicCategories()
      setActiveDynamicId(row.id)
    }
  }

  async function removeCategory(id: number, label: string) {
    if (!confirm(`Delete "${label}" and everything in it?`)) return
    await fetch(`/api/manage-categories?id=${id}`, { method: 'DELETE' }).catch(() => {})
    if (activeDynamicId === id) setActiveDynamicId(null)
    loadDynamicCategories()
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left pane -- always visible instead of a drawer you have to open,
          narrow so the content pane keeps most of the width on a phone. */}
      <div className="w-32 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        {LIST_ITEMS.map(entry => (
          <button key={entry.key} onClick={() => pick(entry.key)}
            className={`w-full flex items-start gap-1 text-left px-2 py-2 text-[11px] font-medium leading-tight transition
              ${!activeDynamic && view === entry.key ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}>
            {entry.icon && <span className="shrink-0">{entry.icon}</span>}<span>{entry.label}</span>
          </button>
        ))}

        {dynamicCategories.length > 0 && (
          <div className="mt-1 pt-1 border-t border-gray-200">
            <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-gray-400 uppercase tracking-wide">Added by you</p>
            {dynamicCategories.map(c => (
              <div key={c.id} className={`flex items-start ${activeDynamicId === c.id ? 'bg-blue-100' : ''}`}>
                <button onClick={() => pickDynamic(c.id)}
                  className={`flex-1 min-w-0 text-left px-2 py-2 text-[11px] font-medium leading-tight transition
                    ${activeDynamicId === c.id ? 'text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}>
                  {c.label}
                </button>
                {canManage && (
                  <button onClick={() => removeCategory(c.id, c.label)} title="Delete category"
                    className="shrink-0 px-1.5 pt-2 text-gray-300 hover:text-red-500 font-bold text-xs">×</button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="mt-1 pt-1 border-t border-gray-200 px-1.5 pb-2">
            {showAddCategory ? (
              <form onSubmit={addCategory} className="space-y-1 py-1">
                <input autoFocus value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)}
                  placeholder="Name *"
                  className="w-full text-[10px] bg-white border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                <div className="flex items-center gap-1">
                  <button type="submit" disabled={savingCategory || !newCategoryLabel.trim()}
                    className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
                    {savingCategory ? '…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
                    className="text-[10px] font-semibold px-1.5 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition">
                    ✕
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddCategory(true)}
                className="w-full text-left px-1 py-2 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded transition">
                + Add Category
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right pane -- whichever category is selected, full remaining width. */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {activeDynamic ? (
          <DynamicCategoryPage categoryId={activeDynamic.id} categoryLabel={activeDynamic.label} canManage={canManage} />
        ) : (<>
          {view === 'rota' && <div className="px-2"><RotaTab canManage={canManage} /></div>}
          {view === 'audio' && <ContentPage contentKey="advert_audio_roadside" title="Advert 1 — Audio (for Roadside)" />}
          {view === 'audio_status' && <AdvertStatusPanel />}
          {view === 'jingle' && <ManageLogPanel category="audio_jingle" label="Jingle Log" icon="🎵" />}
          {view === 'equipment' && <ManageLogPanel category="audio_equipment_check" label="Equipment Check" icon="🔊" />}
          {view === 'photoshop' && <ContentPage contentKey="advert_photo_photoshop" title="Advert 2 — Photo (Photoshop Files)" />}
          {view === 'whatsapp' && <ContentPage contentKey="advert_photo_whatsapp" title="Advert 3 — Photo (WhatsApp Advert)" />}
          {view === 'cuttings' && <ContentPage contentKey="advert_photo_cuttings" title="Advert 4 — Photo (Cuttings)" />}
          {view === 'video' && <ContentPage contentKey="advert_video" title="Advert 5 — Video Advert" />}
          {view === 'advert_log' && <ClosingReportLogView field="advert_played" label="Advert" icon="📢" />}
          {view === 'staff_dress' && <ClosingReportLogView field="no_tshirt_staff" label="Dress Code" icon="👕" />}
          {view === 'tutorial' && <ContentPage contentKey="training_tutorial" title="📖 App Tutorial" />}
          {view === 'training_laws' && <ContentPage contentKey="training_laws" title="⚖️ Company Laws" />}
          {view === 'assessment' && <AssessmentPanel />}
          {view === 'logs' && <div className="px-2"><LogsPage /></div>}
          {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
        </>)}
      </div>
    </div>
  )
}
