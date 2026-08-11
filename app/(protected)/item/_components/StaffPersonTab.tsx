'use client'
import dynamic from 'next/dynamic'
import {
  TimesTab, PayslipsTab, TeamProfilesTab, ViolationsTab, RotaTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import DressCodeFlagsPanel from './DressCodeFlagsPanel'
import ClosingReportLogView from './ClosingReportLogView'
import AssessmentPanel from './AssessmentPanel'
import StaffMeetingPanel from './StaffMeetingPanel'
import DynamicCategoryPage from './DynamicCategoryPage'
import { FIXED_CATEGORY_LABELS } from './manageViewData'
import type { StaffView } from './staffViewData'

export { ALL_STAFF_NAMES }

// Users and Roles & Permissions each still live at /users and /roles as
// their own standalone routes too, but pulled in and rendered inline here
// (like VendorsPage/CustomersPage are inside Grony Cash) so picking either
// from Joe/Grony's Team section keeps this tab's shell up instead of
// navigating away. AccessPage merges the two behind one tab switcher,
// sharing a single users+roles fetch between them.
const AccessPage = dynamic(() => import('./AccessPage'), {
  ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const LogsPage = dynamic(() => import('../../logs/page'), {
  ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

// Just the right-pane content for whichever Staff view is active -- the
// left-pane rows (personal tabs, the Joe/Grony "Viewing" picker, and the
// Team section) now live in item/page.tsx's single merged pane alongside
// Cash's and Manage's own rows, all driven by one shared `lossView` state
// (see STAFF_PERSONAL_ITEMS/STAFF_TEAM_ITEMS in staffViewData.ts).
//
// `viewingName` is whose Payslips show -- always your own for a regular
// staff member, switchable for Joe/Grony via the pane's Viewing picker.
// Personal Payslips ignores it and drops out of the pane entirely while
// viewing someone else (see item/page.tsx's viewingSelf) since Team
// Payslips already has its own per-staff picker; Profile still only ever
// means "my own login". Times/Violations/Ana used to be personal tabs too
// -- Times and Violations moved to Team Times/Team Penalty Points (which
// already cover "just me" as a special case of "everyone"), Ana had no team
// equivalent so it's gone. Team Times renders the same TimesTab component
// with no viewingStaff at all (not even your own) -- that's the mode it
// already supports for showing every active staff member's clock history
// side by side in one grid, the same shared view the pre-Personal/Team
// split /staff route's own Times tab always showed everyone -- including
// the clock-in button itself, so this is still how anyone with Team access
// clocks in and out. `openAddSignal` is the "+" shortcut menu's Staff Time
// entry (see item/page.tsx's handleShortcut) -- TimesTab's own admin "add
// entry" form opens on it regardless of whose page it's opened from.
// `canSeeTeam`/`canSeeUsers`/`canSeeRoles` each gate their own view
// independently now (Roles & Permissions screen) instead of one blanket
// isBuilder flag, so a role can be granted Team without also getting Users.
//
// Team Rota/Team Dress Code/Team Display/Team Meeting/Team Tutorial/Team
// Company Laws Agreement/Team Assessment/Team Logs moved here from
// Manage's own content (GronyManageTab) -- they're all about staff/the
// team as a whole, so they're gated by canSeeTeam like the rest of this
// component instead of canSeeManage. Every "Staff ..." label became
// "Team ..." (and every page-title/PageToolIcons scope alongside it, not
// just the pane button -- a couple of existing custom tasks may need
// re-finding under the new scope name as a result) -- Tutorial/Company
// Laws Agreement/Assessment also lost their separate "Training" sub-header,
// merging into this same flat list since they're no less "about the team"
// than anything else here. `canManage` and `staffRoster`/`routablePages`
// are only needed for Team Rota's write actions and Team Meeting's
// "discuss on page" picker respectively.
//
// Team Payslips/Team Profiles are gated by `canManage` (owner-level only --
// Grony/Joe), not `canSeeTeam` -- they're reached from Settings now (see
// SettingsPane.tsx), not the main pane's Team section, since they carry
// every staff member's pay amounts and bank details and shouldn't come
// along for free just from granting someone the general Team permission.
//
// Team Payments is a different thing entirely -- the ex-"Added by you"
// category still literally named "Staff Payments" in the database (see
// FIXED_CATEGORY_LABELS in manageViewData.ts), just renamed in the pane and
// gated by the general canSeeTeam like the rest of this section instead of
// canManage. `categoryIds` resolves its (and Manage's own three ex-"Added
// by you" categories') real numeric id at runtime -- see
// useFixedCategoryIds.
//
// Team Behaviour is two stacked, independent panels rather than one of the
// dynamic-category system's multi-tab pages -- a ContentPage (the laws/
// standards staff are held to, free-text and owner-editable, same as
// Company Laws) above a ManageLogPanel (dated notes on an actual incident
// and whatever corrective action was taken, same free-text-log shape as
// every other simple Manage category). Each renders its own PageToolIcons,
// so Team Behaviour Laws and Behaviour Incidents get separate task buckets
// rather than sharing one.
export default function StaffContent({
  view, viewingName, role, username, canSeeTeam, canSeeUsers, canSeeRoles, canManage,
  staffRoster, routablePages, categoryIds, openAddSignal,
}: {
  view: StaffView
  viewingName: string
  role: string; username: string
  canSeeTeam: boolean; canSeeUsers: boolean; canSeeRoles: boolean; canManage: boolean
  staffRoster: string[]
  routablePages: string[]
  categoryIds: Record<string, number>
  openAddSignal?: number
}) {
  const isSelf = viewingName.toLowerCase() === username.toLowerCase()
  const rotaLaws = useLawsPanel('showTeamRotaLaws')
  const assessmentLaws = useLawsPanel('showTeamAssessmentLaws')
  const logsLaws = useLawsPanel('showTeamLogsLaws')

  function inlineLaws(scopeKey: string, panel: ReturnType<typeof useLawsPanel>) {
    return (<>
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={panel.show} setShow={panel.setShow}
          openForm={panel.openForm} setOpenForm={panel.setOpenForm}
          hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
          activeFilters={panel.activeFilters} toggleFilter={panel.toggleFilter} dark={false} />
      </div>
      {panel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={panel.bumpRefresh}
            openForm={panel.openForm} setOpenForm={panel.setOpenForm}
            hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}

              activeFilters={panel.activeFilters} />
        </div>
      )}
    </>)
  }

  return (<>
    {view === 'staffPayslips' && <PayslipsTab role={role} username={username} viewingStaff={viewingName} />}
    {view === 'staffProfile' && isSelf && <ProfileTab />}
    {canSeeTeam && view === 'teamTimes' && <TimesTab username={username} role={role} openAddSignal={openAddSignal} />}
    {canSeeTeam && view === 'team_payments' && (
      <DynamicCategoryPage categoryId={categoryIds[FIXED_CATEGORY_LABELS.team_payments]} categoryLabel="Team Payments" canManage={canManage} />
    )}
    {canManage && view === 'teamPayslips' && <PayslipsTab role={role} username={username} />}
    {canManage && view === 'teamProfiles' && <TeamProfilesTab />}
    {canSeeTeam && view === 'allStaff' && <ViolationsTab role={role} username={username} />}
    {canSeeTeam && view === 'team_behaviour' && (<>
      <ContentPage contentKey="team_behaviour_laws" title="🚦 Team Behaviour Laws" submenu="Team Behaviour" />
      <ManageLogPanel category="team_behaviour_log" label="Behaviour Incidents" icon="🚦" />
    </>)}
    {canSeeTeam && view === 'rota' && <div className="px-2 space-y-2 pt-2">{inlineLaws('Team Rota', rotaLaws)}<RotaTab canManage={canManage} /></div>}
    {canSeeTeam && view === 'staff_dress' && (<>
      <DressCodeFlagsPanel />
      <ClosingReportLogView field="no_tshirt_staff" label="Team Dress Code" icon="👕" />
    </>)}
    {canSeeTeam && view === 'staff_display' && <ManageLogPanel category="staff_display" label="Team Display" icon="📌" />}
    {canSeeTeam && view === 'staff_meeting' && <StaffMeetingPanel staffRoster={staffRoster} routablePages={routablePages} />}
    {canSeeTeam && view === 'tutorial' && <ContentPage contentKey="training_tutorial" title="📖 Team Tutorial" submenu="Team Tutorial" />}
    {canSeeTeam && view === 'training_laws' && <ContentPage contentKey="training_laws" title="⚖️ Team Company Laws Agreement" submenu="Team Company Laws Agreement" />}
    {canSeeTeam && view === 'assessment' && (<div className="px-2 pt-2">{inlineLaws('Team Assessment', assessmentLaws)}<AssessmentPanel /></div>)}
    {canSeeTeam && view === 'logs' && <div className="px-2 space-y-2 pt-2">{inlineLaws('Team Logs', logsLaws)}<LogsPage /></div>}
    {(canSeeUsers || canSeeRoles) && (view === 'users' || view === 'roles') && (
      <AccessPage initialTab={view === 'roles' ? 'roles' : 'users'} canSeeUsers={canSeeUsers} canSeeRoles={canSeeRoles} />
    )}
  </>)
}
