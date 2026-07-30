'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import AdvertStatusPanel from './AdvertStatusPanel'
import AssessmentPanel from './AssessmentPanel'
import DynamicCategoryPage from './DynamicCategoryPage'
import SavedFlash from './SavedFlash'
import TasksView from './TasksView'
import OpenerView from './OpenerView'
import CloserView from './CloserView'
import PaneHomeDaily from './PaneHomeDaily'
import type { Violation } from './useViolations'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './SidePane'

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
  | 'tasks' | 'opener' | 'closer'
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
// Tasks/Opener/Closer used to live on the bottom Role Bar, shared with
// Grony Cash's own Joe tab -- now each top-level tab gets its own Tasks
// (see item/page.tsx's manageTasksViolations split), and Opener/Closer move
// here specifically since their daily counts/closing reports are an
// operational concern, same family as Rota and the checklist categories
// below.
const LIST_ITEMS: { key: ManageView; label: string; icon?: string }[] = [
  { key: 'tasks', label: 'Tasks', icon: '✅' },
  { key: 'opener', label: 'Opener', icon: '🌅' },
  { key: 'closer', label: 'Closer', icon: '🌙' },
  { key: 'audio', label: 'Audio', icon: '🎙️' },
  { key: 'audio_status', label: 'Advert Status', icon: '📋' },
  { key: 'jingle', label: 'Jingle Log', icon: '🎵' },
  { key: 'equipment', label: 'Equipment Check', icon: '🔊' },
  { key: 'photoshop', label: 'Photoshop', icon: '🖌️' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { key: 'cuttings', label: 'Cuttings', icon: '✂️' },
  { key: 'video', label: 'Video', icon: '🎬' },
  { key: 'advert_log', label: 'Daily Log', icon: '📢' },
  { key: 'staff_dress', label: 'Dress Code', icon: '👕' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon })),
  { key: 'tutorial', label: 'Tutorial', icon: '📖' },
  { key: 'training_laws', label: 'Company Laws', icon: '⚖️' },
  { key: 'assessment', label: 'Assessment', icon: '📝' },
  { key: 'rota', label: 'Rota', icon: '🗓️' },
  { key: 'logs', label: 'Logs', icon: '📜' },
]

type DynamicCategory = { id: number; label: string }

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (count duties, item hygiene, shift scheduling, and the
// shop's day-to-day operational checklist categories).
type SubmenuEntry = { label: string; action: () => void }

export default function GronyManageTab({
  initialView, role, username,
  violations, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings,
  manageSubmenus, onGoToViolation, missingClosingReportsCount, onOpenStaff,
  tasksBadge, openerBadge, closerBadge,
  onGoHome, onGoDaily, unreadAnnouncements,
}: {
  initialView?: ManageView; role: string; username: string
  // Tasks/Opener -- see item/page.tsx's manageTasksViolations/
  // openerViolations, shared with Cash's own Tasks and computed once there.
  violations: Violation[]
  openerViolations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  manageSubmenus: SubmenuEntry[]
  onGoToViolation: (key: string) => void
  missingClosingReportsCount: number
  onOpenStaff: () => void
  tasksBadge: number
  openerBadge: number
  closerBadge: number
  // Home/Daily -- see PaneHomeDaily; Daily jumps into Grony Cash's Daily
  // Summary even from here, the same global shortcut it always was.
  onGoHome: () => void
  onGoDaily: () => void
  unreadAnnouncements: number
}) {
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
  const [justAddedCategory, setJustAddedCategory] = useState(false)
  const [displayMode, changeDisplayMode] = useSidePaneDisplayMode()
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

  // Every real submenu on this pane, tagged for TasksView's grouping --
  // clicking an empty bar navigates locally via `pick` (through
  // manageSubmenus' own action, which already does exactly that -- see
  // item/page.tsx) instead of leaving the tab.
  const manageAllSubmenus = manageSubmenus.map(s => ({ ...s, section: 'Grony Manage' }))
  // Manage keeps whatever customTask isn't explicitly tagged to one of its
  // own real submenus -- the "former Bino bucket" violations (advert/
  // jingle/equipment/staff-times) have no single submenu name of their own
  // either, so this mirrors that same "everything else defaults here" rule.
  const isManageTask = (submenu: string) => !manageSubmenus.some(s => s.label === submenu)

  // Audio's own violations have a real fix view here (unlike the generic
  // ViolationFixPanel fallback), so Manage's Tasks navigates to them
  // directly instead of showing that stub message. no_staff_times has no
  // Manage view of its own -- it passes through to the Staff tab exactly
  // like it always has.
  function handleManageViolation(key: string) {
    if (key === 'no_advert') { pick('audio_status'); return }
    if (key === 'jingle_overdue') { pick('jingle'); return }
    if (key === 'equipment_check_overdue') { pick('equipment'); return }
    onGoToViolation(key)
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
      setJustAddedCategory(true)
      setTimeout(() => setJustAddedCategory(false), 2500)
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
      {/* Left pane -- always visible instead of a drawer you have to open.
          Width tightens further in icon-only mode; labels cap at 2 lines
          (line-clamp) rather than pushing the pane wider for long names. */}
      <SidePaneContainer mode={displayMode}
        footer={<PaneHomeDaily mode={displayMode} onHome={onGoHome} onDaily={onGoDaily}
          dailyActive={false} unreadAnnouncements={unreadAnnouncements} />}>
        <SidePaneToggle mode={displayMode} onChange={changeDisplayMode} />

        {LIST_ITEMS.map(entry => {
          const badge = entry.key === 'tasks' ? tasksBadge : entry.key === 'opener' ? openerBadge : entry.key === 'closer' ? closerBadge : undefined
          return (
            <SidePaneButton key={entry.key} icon={entry.icon} label={entry.label} mode={displayMode}
              active={!activeDynamic && view === entry.key} badge={badge} onClick={() => pick(entry.key)} />
          )
        })}

        {dynamicCategories.length > 0 && (
          <div className="mt-1 pt-1 border-t border-blue-700">
            {displayMode !== 'icon' && (
              <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">Added by you</p>
            )}
            {dynamicCategories.map(c => (
              <div key={c.id} className={`flex items-stretch ${activeDynamicId === c.id ? 'bg-white' : ''}`}>
                <SidePaneButton icon="🗂️" label={c.label} mode={displayMode} className="flex-1 min-w-0"
                  active={activeDynamicId === c.id} onClick={() => pickDynamic(c.id)} />
                {canManage && (
                  <button onClick={() => removeCategory(c.id, c.label)} title="Delete category"
                    className={`shrink-0 px-1.5 pt-2 font-bold text-xs ${activeDynamicId === c.id ? 'text-gray-300 hover:text-red-500' : 'text-blue-200 hover:text-red-300'}`}>×</button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="mt-1 pt-1 border-t border-blue-700 px-1.5 pb-2">
            {showAddCategory ? (
              <form onSubmit={addCategory} className="space-y-1 py-1">
                <input autoFocus value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)}
                  placeholder="Name *"
                  className="w-full text-[10px] bg-white border border-blue-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                <div className="flex items-center gap-1">
                  <button type="submit" disabled={savingCategory || !newCategoryLabel.trim()}
                    className="flex-1 text-[10px] font-semibold px-1.5 py-1 rounded bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-40 transition">
                    {savingCategory ? '…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
                    className="text-[10px] font-semibold px-1.5 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition">
                    ✕
                  </button>
                </div>
              </form>
            ) : (
              <SidePaneButton icon="➕" label="Add Category" mode={displayMode} active={false}
                onClick={() => setShowAddCategory(true)} className="w-full text-white hover:bg-white/10 font-semibold" />
            )}
            {justAddedCategory && (
              <p className="text-center pt-1"><SavedFlash show /></p>
            )}
          </div>
        )}
      </SidePaneContainer>

      {/* Right pane -- whichever category is selected, full remaining width. */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {activeDynamic ? (
          <DynamicCategoryPage categoryId={activeDynamic.id} categoryLabel={activeDynamic.label} canManage={canManage} />
        ) : (<>
          {view === 'tasks' && (
            <TasksView violations={violations} allSubmenus={manageAllSubmenus}
              assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              isOwnTask={isManageTask} onGoToViolation={handleManageViolation} />
          )}
          {view === 'opener' && (
            <OpenerView violations={openerViolations}
              assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              onGoToViolation={onGoToViolation} />
          )}
          {view === 'closer' && (
            <CloserView missingClosingReportsCount={missingClosingReportsCount} onOpenStaff={onOpenStaff} />
          )}
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
