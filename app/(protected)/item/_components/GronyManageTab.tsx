'use client'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
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
import { useState } from 'react'

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
  const [selectedGronyCheckItem, setSelectedGronyCheckItem] = useState<ManageView | null>(null)
  const [selectedAdvertItem, setSelectedAdvertItem] = useState<ManageView | null>(null)

  const logCategory = LOG_CATEGORIES.find(c => c.key === view)
  const openerLaws = useLawsPanel('showOpenerLaws')
  const closerLaws = useLawsPanel('showCloserLaws')
  const advertLaws = useLawsPanel('showAdvertLaws')
  const advertStatusLaws = useLawsPanel('showAdvertStatusLaws')
  const gronyChecksLaws = useLawsPanel('showGronyChecksLaws')

  function inlineLaws(scopeKey: string, panel: ReturnType<typeof useLawsPanel>) {
    return (<>
      <div className="px-2 pt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={panel.show} setShow={panel.setShow}
          openForm={panel.openForm} setOpenForm={panel.setOpenForm}
          hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
          activeFilters={panel.activeFilters} toggleFilter={panel.toggleFilter} dark={false} />
      </div>
      {panel.show && (
        <div className="px-2">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={panel.bumpRefresh}
              openForm={panel.openForm} setOpenForm={panel.setOpenForm}
              hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}

              activeFilters={panel.activeFilters} />
          </div>
        </div>
      )}
    </>)
  }

  return (<>
    {view === 'opener' && (<>
      {inlineLaws('Opener', openerLaws)}
      <OpenerView violations={openerViolations}
        assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
        onGoToViolation={onGoToViolation} />
    </>)}
    {view === 'closer' && (<>
      {inlineLaws('Closer', closerLaws)}
      <CloserView missingClosingReportsCount={missingClosingReportsCount} onOpenStaff={onOpenStaff} />
    </>)}
    {view === 'advert' && (<>
      {!selectedAdvertItem ? (<>
        <div className="px-2 pt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
          <LawsToggleBar show={advertLaws.show} setShow={advertLaws.setShow}
            openForm={advertLaws.openForm} setOpenForm={advertLaws.setOpenForm}
            hideZeroFlags={advertLaws.hideZeroFlags} setHideZeroFlags={advertLaws.setHideZeroFlags}
            activeFilters={advertLaws.activeFilters} toggleFilter={advertLaws.toggleFilter} dark={false} />
        </div>
        {advertLaws.show && (
          <div className="px-2">
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <div className="divide-y">
                {ADVERT_ITEMS.map((item) => (
                  <button key={item.key} onClick={() => setSelectedAdvertItem(item.key)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </>) : (<>
        <div className="px-2 pt-2">
          <button onClick={() => setSelectedAdvertItem(null)} className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to Advert
          </button>
        </div>
        {selectedAdvertItem === 'audio' && <ContentPage contentKey="advert_audio_roadside" title="Advert 1 — Audio (for Roadside)" submenu="Audio" />}
        {selectedAdvertItem === 'audio_status' && (<>
          {inlineLaws('Advert Status', advertStatusLaws)}
          <AdvertStatusPanel />
        </>)}
        {selectedAdvertItem === 'jingle' && <ManageLogPanel category="audio_jingle" label="Jingle Log" icon="🎵" />}
        {selectedAdvertItem === 'equipment' && <ManageLogPanel category="audio_equipment_check" label="Equipment Check" icon="🔊" />}
        {selectedAdvertItem === 'photoshop' && <ContentPage contentKey="advert_photo_photoshop" title="Advert 2 — Photo (Photoshop Files)" submenu="Photoshop" />}
        {selectedAdvertItem === 'whatsapp' && <ContentPage contentKey="advert_photo_whatsapp" title="Advert 3 — Photo (WhatsApp Advert)" submenu="WhatsApp" />}
        {selectedAdvertItem === 'cuttings' && <ContentPage contentKey="advert_photo_cuttings" title="Advert 4 — Photo (Cuttings)" submenu="Cuttings" />}
        {selectedAdvertItem === 'video' && <ContentPage contentKey="advert_video" title="Advert 5 — Video Advert" submenu="Video" />}
      </>)}
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
      {!selectedGronyCheckItem ? (<>
        <div className="px-2 pt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
          <LawsToggleBar show={gronyChecksLaws.show} setShow={gronyChecksLaws.setShow}
            openForm={gronyChecksLaws.openForm} setOpenForm={gronyChecksLaws.setOpenForm}
            hideZeroFlags={gronyChecksLaws.hideZeroFlags} setHideZeroFlags={gronyChecksLaws.setHideZeroFlags}
            activeFilters={gronyChecksLaws.activeFilters} toggleFilter={gronyChecksLaws.toggleFilter} dark={false} />
        </div>
        {gronyChecksLaws.show && (
          <div className="px-2">
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <div className="divide-y">
                {GRONY_CHECKS_ITEMS.map((item) => (
                  <button key={item.key} onClick={() => setSelectedGronyCheckItem(item.key)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <GronyChecksGrid />
      </>) : (<>
        <div className="px-2 pt-2">
          <button onClick={() => setSelectedGronyCheckItem(null)} className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to Grony Checks
          </button>
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
    </>)}
    {logCategory && <ManageLogPanel category={logCategory.key} label={logCategory.label} icon={logCategory.icon} />}
  </>)
}
