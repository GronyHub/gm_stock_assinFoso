'use client'
import dynamic from 'next/dynamic'
import {
  TimesTab, PayslipsTab, ViolationsTab, AnalyticsTab, AssignmentsTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
import type { StaffView } from './staffViewData'

export { ALL_STAFF_NAMES }

// Users lives at /users as its own page/route, but pulled in and rendered
// inline here (like VendorsPage/CustomersPage are inside Grony Cash) so
// picking it from Joe/Grony's Team section keeps this tab's shell up
// instead of navigating away.
const UsersPage = dynamic(() => import('../../users/page'), {
  ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})
const RolesPage = dynamic(() => import('../../roles/page'), {
  ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

// Just the right-pane content for whichever Staff view is active -- the
// left-pane rows (personal tabs, the Joe/Grony "Viewing" picker, and the
// Team section) now live in item/page.tsx's single merged pane alongside
// Cash's and Manage's own rows, all driven by one shared `lossView` state
// (see STAFF_PERSONAL_ITEMS/STAFF_TEAM_ITEMS in staffViewData.ts).
//
// `viewingName` is whose personal records show -- always your own for a
// regular staff member, switchable for Joe/Grony via the pane's Viewing
// picker. `canSeeTeam`/`canSeeUsers`/`canSeeRoles` each gate their own view
// independently now (Roles & Permissions screen) instead of one blanket
// isBuilder flag, so a role can be granted Team without also getting Users.
export default function StaffContent({
  view, viewingName, role, username, canSeeTeam, canSeeUsers, canSeeRoles, vtab, setVtab, teamVtab, setTeamVtab, openAddSignal,
}: {
  view: StaffView
  viewingName: string
  role: string; username: string
  canSeeTeam: boolean; canSeeUsers: boolean; canSeeRoles: boolean
  vtab: ViolationView; setVtab: (v: ViolationView) => void
  teamVtab: ViolationView; setTeamVtab: (v: ViolationView) => void
  openAddSignal?: number
}) {
  const isSelf = viewingName.toLowerCase() === username.toLowerCase()
  return (<>
    {view === 'staffTimes' && <TimesTab username={username} role={role} openAddSignal={isSelf ? openAddSignal : undefined} />}
    {view === 'staffPayslips' && <PayslipsTab role={role} username={username} viewingStaff={viewingName} />}
    {view === 'staffViolations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} viewingStaff={viewingName} />}
    {view === 'staffAnalytics' && <AnalyticsTab viewingStaff={viewingName} />}
    {view === 'staffAssignments' && <AssignmentsTab role={role} username={username} viewingStaff={viewingName} />}
    {view === 'staffProfile' && isSelf && <ProfileTab />}
    {canSeeTeam && view === 'teamPayslips' && <PayslipsTab role={role} username={username} />}
    {canSeeTeam && view === 'allStaff' && <ViolationsTab role={role} username={username} vtab={teamVtab} setVtab={setTeamVtab} />}
    {canSeeUsers && view === 'users' && <UsersPage />}
    {canSeeRoles && view === 'roles' && <RolesPage />}
  </>)
}
