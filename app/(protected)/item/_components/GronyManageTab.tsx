'use client'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import PageToolIcons from './PageToolIcons'
import AdvertStatusPanel from './AdvertStatusPanel'
import DynamicCategoryPage from './DynamicCategoryPage'
import PropertiesPage from './PropertiesPage'
import OpenerView from './OpenerView'
import CloserView from './CloserView'
import type { Violation } from './useViolations'
import { LOG_CATEGORIES, FIXED_CATEGORY_LABELS, type ManageView } from './manageViewData'

export type { ManageView }

// Just the right-pane content for whichever Manage view is active -- the
// left-pane list (fixed items, including the ex-"Added by you" categories)
// now lives in item/page.tsx's single merged pane, alongside Cash's and
// Staff's own rows, all driven by one shared `lossView` state (see
// MANAGE_LIST_ITEMS in manageViewData.ts for the row data this switches on).
export default function GronyManageContent({
  view, canManage, categoryIds,
  openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings,
  onGoToViolation, missingClosingReportsCount, onOpenStaff, propertiesInitialTab,
}: {
  view: ManageView
  canManage: boolean
  categoryIds: Record<string, number>
  openerViolations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation: (key: string) => void
  missingClosingReportsCount: number
  onOpenStaff: () => void
  propertiesInitialTab?: 'all' | 'available' | 'away' | null
}) {
  const logCategory = LOG_CATEGORIES.find(c => c.key === view)

  return (<>
    {view === 'opener' && (<>
      <div className="px-2 pt-2"><PageToolIcons scopeKey="Opener" /></div>
      <OpenerView violations={openerViolations}
        assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
        onGoToViolation={onGoToViolation} />
    </>)}
    {view === 'closer' && (<>
      <div className="px-2 pt-2"><PageToolIcons scopeKey="Closer" /></div>
      <CloserView missingClosingReportsCount={missingClosingReportsCount} onOpenStaff={onOpenStaff} />
    </>)}
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
    {view === 'properties' && <PropertiesPage initialTab={propertiesInitialTab} />}
    {view === 'unfortunate_events' && (
      <DynamicCategoryPage categoryId={categoryIds[FIXED_CATEGORY_LABELS.unfortunate_events]} categoryLabel="Unfortunate Events" canManage={canManage} />
    )}
    {view === 'security_chk' && (
      <DynamicCategoryPage categoryId={categoryIds[FIXED_CATEGORY_LABELS.security_chk]} categoryLabel="Security chk" canManage={canManage} />
    )}
    {view === 'app_info' && (
      <DynamicCategoryPage categoryId={categoryIds[FIXED_CATEGORY_LABELS.app_info]} categoryLabel="App info" canManage={canManage} />
    )}
    {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
  </>)
}
