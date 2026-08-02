'use client'
import dynamic from 'next/dynamic'
import ClosingReportLogView from './ClosingReportLogView'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import DressCodeFlagsPanel from './DressCodeFlagsPanel'
import PageToolIcons from './PageToolIcons'
import AdvertStatusPanel from './AdvertStatusPanel'
import AssessmentPanel from './AssessmentPanel'
import DynamicCategoryPage from './DynamicCategoryPage'
import PropertiesPage from './PropertiesPage'
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

// Just the right-pane content for whichever Manage view is active -- the
// left-pane list (fixed items + dynamic categories + Add Category) now
// lives in item/page.tsx's single merged pane, alongside Cash's and Staff's
// own rows, all driven by one shared `lossView` state (see MANAGE_LIST_ITEMS
// in manageViewData.ts for the row data this switches on).
export default function GronyManageContent({
  view, activeDynamic, canManage,
  openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings,
  onGoToViolation, missingClosingReportsCount, onOpenStaff,
}: {
  view: ManageView
  activeDynamic?: DynamicCategory
  canManage: boolean
  openerViolations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation: (key: string) => void
  missingClosingReportsCount: number
  onOpenStaff: () => void
}) {
  const logCategory = LOG_CATEGORIES.find(c => c.key === view)

  if (activeDynamic) {
    return <DynamicCategoryPage categoryId={activeDynamic.id} categoryLabel={activeDynamic.label} canManage={canManage} />
  }

  return (<>
    {view === 'opener' && (
      <OpenerView violations={openerViolations}
        assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
        onGoToViolation={onGoToViolation} />
    )}
    {view === 'closer' && (
      <CloserView missingClosingReportsCount={missingClosingReportsCount} onOpenStaff={onOpenStaff} />
    )}
    {view === 'rota' && <div className="px-2 space-y-2 pt-2"><PageToolIcons scopeKey="Rota" /><RotaTab canManage={canManage} /></div>}
    {view === 'audio' && <ContentPage contentKey="advert_audio_roadside" title="Advert 1 — Audio (for Roadside)" submenu="Audio" />}
    {view === 'audio_status' && (<>
      <div className="px-2 pt-2"><PageToolIcons scopeKey="Advert Status" /></div>
      <AdvertStatusPanel />
    </>)}
    {view === 'jingle' && <ManageLogPanel category="audio_jingle" label="Jingle Log" icon="🎵" />}
    {view === 'equipment' && <ManageLogPanel category="audio_equipment_check" label="Equipment Check" icon="🔊" />}
    {view === 'photoshop' && <ContentPage contentKey="advert_photo_photoshop" title="Advert 2 — Photo (Photoshop Files)" submenu="Photoshop" />}
    {view === 'whatsapp' && <ContentPage contentKey="advert_photo_whatsapp" title="Advert 3 — Photo (WhatsApp Advert)" submenu="WhatsApp" />}
    {view === 'cuttings' && <ContentPage contentKey="advert_photo_cuttings" title="Advert 4 — Photo (Cuttings)" submenu="Cuttings" />}
    {view === 'video' && <ContentPage contentKey="advert_video" title="Advert 5 — Video Advert" submenu="Video" />}
    {view === 'advert_log' && (<>
      <div className="px-2 pt-2"><PageToolIcons scopeKey="Advert Daily Log" /></div>
      <ClosingReportLogView field="advert_played" label="Advert" icon="📢" />
    </>)}
    {view === 'staff_dress' && (<>
      <div className="px-2 pt-2"><PageToolIcons scopeKey="Dress Code" /></div>
      <DressCodeFlagsPanel />
      <ClosingReportLogView field="no_tshirt_staff" label="Dress Code" icon="👕" />
    </>)}
    {view === 'tutorial' && <ContentPage contentKey="training_tutorial" title="📖 App Tutorial" submenu="Tutorial" />}
    {view === 'training_laws' && <ContentPage contentKey="training_laws" title="⚖️ Company Laws" submenu="Company Laws" />}
    {view === 'assessment' && (<div className="px-2 pt-2"><PageToolIcons scopeKey="Assessment" /><AssessmentPanel /></div>)}
    {view === 'logs' && <div className="px-2 space-y-2 pt-2"><PageToolIcons scopeKey="Logs" /><LogsPage /></div>}
    {view === 'properties' && <PropertiesPage />}
    {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
  </>)
}
