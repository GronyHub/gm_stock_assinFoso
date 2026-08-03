'use client'
import dynamic from 'next/dynamic'
import {
  TimesTab, PayslipsTab, TeamProfilesTab, ViolationsTab, AnalyticsTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
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

// Just the right-pane content for whichever Staff view is active -- the
// left-pane rows (personal tabs, the Joe/Grony "Viewing" picker, and the
// Team section) now live in item/page.tsx's single merged pane alongside
// Cash's and Manage's own rows, all driven by one shared `lossView` state
// (see STAFF_PERSONAL_ITEMS/STAFF_TEAM_ITEMS in staffViewData.ts).
//
// `viewingName` is whose Times/Analytics show -- always your own for a
// regular staff member, switchable for Joe/Grony via the pane's Viewing
// picker. Payslips/Violations ignore it now (they no longer show up in the
// pane at all while viewing someone else -- see item/page.tsx's
// viewingSelf) since Team Payslips/Team Violations already have their own
// per-staff picker; Profile still only ever means "my own login".
// `canSeeTeam`/`canSeeUsers`/`canSeeRoles` each gate their own view
// independently now (Roles & Permissions screen) instead of one blanket
// isBuilder flag, so a role can be granted Team without also getting Users.
export default function StaffContent({
  view, viewingName, role, username, canSeeTeam, canSeeUsers, canSeeRoles, openAddSignal,
}: {
  view: StaffView
  viewingName: string
  role: string; username: string
  canSeeTeam: boolean; canSeeUsers: boolean; canSeeRoles: boolean
  openAddSignal?: number
}) {
  const isSelf = viewingName.toLowerCase() === username.toLowerCase()
  return (<>
    {view === 'staffTimes' && <TimesTab username={username} role={role} openAddSignal={isSelf ? openAddSignal : undefined} viewingStaff={viewingName} />}
    {view === 'staffPayslips' && <PayslipsTab role={role} username={username} viewingStaff={viewingName} />}
    {view === 'staffViolations' && <ViolationsTab role={role} username={username} viewingStaff={viewingName} />}
    {view === 'staffAnalytics' && <AnalyticsTab viewingStaff={viewingName} />}
    {view === 'staffProfile' && isSelf && <ProfileTab />}
    {canSeeTeam && view === 'teamPayslips' && <PayslipsTab role={role} username={username} />}
    {canSeeTeam && view === 'teamProfiles' && <TeamProfilesTab />}
    {canSeeTeam && view === 'allStaff' && <ViolationsTab role={role} username={username} />}
    {(canSeeUsers || canSeeRoles) && (view === 'users' || view === 'roles') && (
      <AccessPage initialTab={view === 'roles' ? 'roles' : 'users'} canSeeUsers={canSeeUsers} canSeeRoles={canSeeRoles} />
    )}
  </>)
}
