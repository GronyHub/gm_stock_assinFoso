'use client'
import dynamic from 'next/dynamic'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import AdvertStatusPanel from './AdvertStatusPanel'
import AssessmentPanel from './AssessmentPanel'
import DynamicCategoryPage from './DynamicCategoryPage'
import TasksView from './TasksView'
import OpenerView from './OpenerView'
import CloserView from './CloserView'
import type { Violation } from './useViolations'
import { LOG_CATEGORIES, type ManageView, type DynamicCategory } from './manageViewData'

export type { ManageView }

// Staff (Times/Payslips/Violations/Analytics/Assignments) and Home/Daily
// live outside this component now -- see item/page.tsx's merged pane. Rota
// stays here since it's a shared weekly schedule across everyone, not one
// person's record.
const RotaTab = dynamic(() => import('../../staff/StaffClient').then(m => ({ default: m.RotaTab })), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const LogsPage = dynamic(() => import('../../logs/page'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

type SubmenuEntry = { label: string; action: () => void }

// Just the right-pane content for whichever Manage view is active -- the
// left-pane list (fixed items + dynamic categories + Add Category) now
// lives in item/page.tsx's single merged pane, alongside Cash's and Staff's
// own rows, all driven by one shared `lossView` state (see MANAGE_LIST_ITEMS
// in manageViewData.ts for the row data this switches on).
export default function GronyManageContent({
  view, activeDynamic, canManage,
  violations, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings,
  manageSubmenus, onGoToViolation, onPickView, missingClosingReportsCount, onOpenStaff,
}: {
  view: ManageView
  activeDynamic?: DynamicCategory
  canManage: boolean
  violations: Violation[]
  openerViolations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  manageSubmenus: SubmenuEntry[]
  onGoToViolation: (key: string) => void
  onPickView: (view: ManageView) => void
  missingClosingReportsCount: number
  onOpenStaff: () => void
}) {
  const logCategory = LOG_CATEGORIES.find(c => c.key === view)

  // Every real submenu on this pane, tagged for TasksView's grouping --
  // clicking an empty bar navigates locally via onPickView (through
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
  // Manage view of its own -- it passes through to the Staff section
  // exactly like it always has.
  function handleManageViolation(key: string) {
    if (key === 'no_advert') { onPickView('audio_status'); return }
    if (key === 'jingle_overdue') { onPickView('jingle'); return }
    if (key === 'equipment_check_overdue') { onPickView('equipment'); return }
    onGoToViolation(key)
  }

  if (activeDynamic) {
    return <DynamicCategoryPage categoryId={activeDynamic.id} categoryLabel={activeDynamic.label} canManage={canManage} />
  }

  return (<>
    {view === 'manageTasks' && (
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
  </>)
}
