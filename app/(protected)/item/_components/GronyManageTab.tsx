'use client'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import AdvertStatusPanel from './AdvertStatusPanel'
import DynamicCategoryPage from './DynamicCategoryPage'
import PropertiesPage from './PropertiesPage'
import OpenerView from './OpenerView'
import CloserView from './CloserView'
import GronyChecksGrid from './GronyChecksGrid'
import type { Violation } from './useViolations'
import { LOG_CATEGORIES, FIXED_CATEGORY_LABELS, GRONY_CHECKS_ITEMS, ADVERT_ITEMS, type ManageView } from './manageViewData'

export type { ManageView }

// Just the right-pane content for whichever Manage view is active -- the
// left-pane list (fixed items, including the ex-"Added by you" categories)
// now lives in item/page.tsx's single merged pane, alongside Cash's and
// Staff's own rows, all driven by one shared `lossView` state (see
// MANAGE_LIST_ITEMS in manageViewData.ts for the row data this switches on).
import { useState, Fragment } from 'react'

export default function GronyManageContent({
  view, canManage, categoryIds,
  openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings,
  onGoToViolation, onSelectCheckType, missingClosingReportsCount, onOpenStaff, propertiesInitialTab,
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
  onSelectCheckType?: (key: ManageView) => void
  missingClosingReportsCount: number
  onOpenStaff: () => void
  propertiesInitialTab?: 'all' | 'available' | 'away' | null
}) {
  // Both default to their first sub-page (rather than null) since Advert and
  // Grony Checks are now their own top-level tabs (see item/page.tsx's
  // liveMode === 'advert'/'gronyChecks') -- landing on either should show
  // something immediately, same as every other tab, instead of an empty
  // radio row with nothing picked yet. Grony Checks' first item is the Grid
  // table itself (GRONY_CHECKS_ITEMS[0].key === 'grony_checks').
  const [selectedGronyCheckItem, setSelectedGronyCheckItem] = useState<ManageView>(GRONY_CHECKS_ITEMS[0].key)
  const [selectedAdvertItem, setSelectedAdvertItem] = useState<ManageView>(ADVERT_ITEMS[0].key)

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)

  return (<>
    {view === 'opener' && (
      <OpenerView violations={openerViolations}
        assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
        onGoToViolation={onGoToViolation} />
    )}
    {view === 'closer' && (
      <CloserView missingClosingReportsCount={missingClosingReportsCount} onOpenStaff={onOpenStaff} />
    )}
    {view === 'advert' && (<>
      {/* Picker for ADVERT_ITEMS' 8 sub-pages, always visible above whichever
          one is selected -- compact plain-text radios, same treatment as
          Manage's own combined list and Expenses' filter row, now that
          Advert is its own top-level tab (see item/page.tsx's
          liveMode === 'advert') rather than one row buried in Manage's
          list. This used to live behind a per-page "Laws & Tasks" toggle
          and got deleted along with it when that toggle was replaced by one
          global icon, leaving this whole view permanently blank
          (selectedAdvertItem had no way left to ever change) -- restored
          here, no back button needed: picking a different radio just swaps
          what's shown below directly. */}
      <div className="px-1.5 py-0.5 bg-white border-b border-gray-200 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
        {ADVERT_ITEMS.map((item, i) => (
          <Fragment key={item.key}>
            {i > 0 && <span className="text-gray-300 text-[9px]">·</span>}
            <label className="shrink-0 flex items-center gap-0.5 cursor-pointer hover:underline select-none text-[9px] whitespace-nowrap text-gray-700">
              <input type="radio" name="advertItemRadio" checked={selectedAdvertItem === item.key} onChange={() => setSelectedAdvertItem(item.key)} className="cursor-pointer w-2.5 h-2.5 shrink-0" />
              <span>{item.icon} {item.label}</span>
            </label>
          </Fragment>
        ))}
      </div>
      {selectedAdvertItem === 'audio' && <ContentPage contentKey="advert_audio_roadside" title="Advert 1 — Audio (for Roadside)" submenu="Audio" />}
      {selectedAdvertItem === 'audio_status' && <AdvertStatusPanel />}
      {selectedAdvertItem === 'jingle' && <ManageLogPanel category="audio_jingle" label="Jingle Log" icon="🎵" />}
      {selectedAdvertItem === 'equipment' && <ManageLogPanel category="audio_equipment_check" label="Equipment Check" icon="🔊" />}
      {selectedAdvertItem === 'photoshop' && <ContentPage contentKey="advert_photo_photoshop" title="Advert 2 — Photo (Photoshop Files)" submenu="Photoshop" />}
      {selectedAdvertItem === 'whatsapp' && <ContentPage contentKey="advert_photo_whatsapp" title="Advert 3 — Photo (WhatsApp Advert)" submenu="WhatsApp" />}
      {selectedAdvertItem === 'cuttings' && <ContentPage contentKey="advert_photo_cuttings" title="Advert 4 — Photo (Cuttings)" submenu="Cuttings" />}
      {selectedAdvertItem === 'video' && <ContentPage contentKey="advert_video" title="Advert 5 — Video Advert" submenu="Video" />}
    </>)}
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
    {view === 'grony_checks' && (<>
      {/* Same restoration + compact-radio treatment as Advert's picker
          above, now that this is also its own top-level tab ("Grony 1-10
          checks", see item/page.tsx's liveMode === 'gronyChecks').
          GRONY_CHECKS_ITEMS' 16 sub-pages (the grid itself plus each
          individual check category) were only ever reachable through a
          picker that got deleted along with the old per-page laws toggle it
          happened to be nested inside -- restored here, no back button
          needed: picking a different radio just swaps what's shown below
          directly. */}
      <div className="px-1.5 py-0.5 bg-white border-b border-gray-200 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
        {GRONY_CHECKS_ITEMS.map((item, i) => (
          <Fragment key={item.key}>
            {i > 0 && <span className="text-gray-300 text-[9px]">·</span>}
            <label className="shrink-0 flex items-center gap-0.5 cursor-pointer hover:underline select-none text-[9px] whitespace-nowrap text-gray-700">
              <input type="radio" name="gronyCheckItemRadio" checked={selectedGronyCheckItem === item.key} onChange={() => setSelectedGronyCheckItem(item.key)} className="cursor-pointer w-2.5 h-2.5 shrink-0" />
              <span>{item.icon} {item.label}</span>
            </label>
          </Fragment>
        ))}
      </div>
      {selectedGronyCheckItem === 'grony_checks' && <GronyChecksGrid />}
      {selectedGronyCheckItem === 'arrangement' && <ManageLogPanel category="arrangement" label="Arrangement" icon="🪑" />}
      {selectedGronyCheckItem === 'cleanliness' && <ManageLogPanel category="cleanliness" label="Cleanliness" icon="🧹" />}
      {selectedGronyCheckItem === 'customer_display' && <ManageLogPanel category="customer_display" label="Customer Display" icon="🖼️" />}
      {selectedGronyCheckItem === 'repair_works' && <ManageLogPanel category="repair_works" label="Repair Works" icon="🔧" />}
      {selectedGronyCheckItem === 'grony_1' && <ManageLogPanel category="grony_1" label="Grony 1" icon="1️⃣" />}
      {selectedGronyCheckItem === 'grony_2' && <ManageLogPanel category="grony_2" label="Grony 2" icon="2️⃣" />}
      {selectedGronyCheckItem === 'grony_3' && <ManageLogPanel category="grony_3" label="Grony 3" icon="3️⃣" />}
      {selectedGronyCheckItem === 'grony_4' && <ManageLogPanel category="grony_4" label="Grony 4" icon="4️⃣" />}
      {selectedGronyCheckItem === 'grony_5' && <ManageLogPanel category="grony_5" label="Grony 5" icon="5️⃣" />}
      {selectedGronyCheckItem === 'grony_6' && <ManageLogPanel category="grony_6" label="Grony 6" icon="6️⃣" />}
      {selectedGronyCheckItem === 'grony_7' && <ManageLogPanel category="grony_7" label="Grony 7" icon="7️⃣" />}
      {selectedGronyCheckItem === 'grony_8' && <ManageLogPanel category="grony_8" label="Grony 8" icon="8️⃣" />}
      {selectedGronyCheckItem === 'grony_9' && <ManageLogPanel category="grony_9" label="Grony 9" icon="9️⃣" />}
      {selectedGronyCheckItem === 'grony_10' && <ManageLogPanel category="grony_10" label="Grony 10" icon="🔟" />}
      {selectedGronyCheckItem === 'security_chk' && <ManageLogPanel category="security_chk" label="Security chk" icon="🔒" />}
    </>)}
    {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
  </>)
}
