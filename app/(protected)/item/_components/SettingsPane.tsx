'use client'
import { SidePaneButton, type DisplayMode } from './SidePane'
import { STAFF_ADMIN_TEAM_ITEMS, type StaffView } from './staffViewData'

// Everything only Joe/Grony (or a role granted one of these) can do -- the
// Viewing picker, Team (payslips/profiles), and Access (Users & Roles/View
// Portal As/Reorder & Rename Lists/Activity Times). Used to open as its own
// second pane alongside the main one, toggled by a "Settings" button --
// with the main pane's own row count now much shorter than it used to be
// (Manage/Team/P&L/CAB/Vendors/Customers/Purchase Orders all folded into
// tabs instead of pane rows), a whole extra pane for a handful of rows read
// as more navigation, not less. Just renders its own sections directly
// inline as more of the same single pane's scrollable list now (see
// item/page.tsx, right where the old Settings toggle button used to sit) --
// no wrapper/border/width/scroll region of its own left to strip since
// SidePaneContainer already provides all of that once.
type SettingsDestination = StaffView | 'viewPortalAs' | 'reorderLists' | 'activityDurations'

type Props = {
  mode: DisplayMode
  activeView: string
  viewingName: string
  myStaffName: string | undefined
  staffRoster: string[]
  pickViewing: (name: string) => void
  pickLossView: (view: SettingsDestination) => void
  canSeeUsers: boolean
  canViewPortalAs: boolean
  canManageRoles: boolean
  canManage: boolean
}

export default function SettingsPane({
  mode, activeView, viewingName, myStaffName, staffRoster, pickViewing, pickLossView,
  canSeeUsers, canViewPortalAs, canManageRoles, canManage,
}: Props) {
  return (
    <>
      {/* Team moved out into its own labeled section in the main pane
          (alongside Cash/Manage/Personal) instead of hiding behind this
          gear icon -- this is now just the name switcher for Personal. */}
      {myStaffName && (
        <div className="mt-1 pt-1 border-t border-white/30">
          {mode !== 'icon' && (
            <p className="pt-1 pb-0.5"><span className="block w-full text-[8px] font-extrabold text-red-700 bg-yellow-400 uppercase tracking-wide px-2 py-1 truncate">Viewing</span></p>
          )}
          <SidePaneButton icon="👤" label="Me" mode={mode}
            active={viewingName.toLowerCase() === myStaffName.toLowerCase()} onClick={() => pickViewing(myStaffName)} />
          {staffRoster.filter(n => n.toLowerCase() !== myStaffName.toLowerCase()).map(name => (
            <SidePaneButton key={name} icon="👤" label={name} mode={mode} divider
              active={viewingName.toLowerCase() === name.toLowerCase()} onClick={() => pickViewing(name)} />
          ))}
        </div>
      )}

      {/* Team Payslips/Team Profiles specifically -- unlike the rest of
          Team (still in the main pane, gated by the general canSeeTeam
          permission), these two carry every staff member's pay amounts
          and bank/bio details, so they stay owner-level-only (Grony/Joe)
          here instead of coming along for free whenever someone (e.g.
          Bino/James) is granted Team access. */}
      {canManage && (
        <div className="mt-1 pt-1 border-t border-white/30">
          {mode !== 'icon' && (
            <p className="pt-1 pb-0.5"><span className="block w-full text-[8px] font-extrabold text-red-700 bg-yellow-400 uppercase tracking-wide px-2 py-1 truncate">Team</span></p>
          )}
          {STAFF_ADMIN_TEAM_ITEMS.map((t, i) => (
            <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={mode} divider={i > 0}
              active={activeView === t.key} onClick={() => pickLossView(t.key)} />
          ))}
        </div>
      )}

      {(canSeeUsers || canManageRoles || canViewPortalAs) && (
        <div className="mt-1 pt-1 border-t border-white/30">
          {mode !== 'icon' && (
            <p className="pt-1 pb-0.5"><span className="block w-full text-[8px] font-extrabold text-red-700 bg-yellow-400 uppercase tracking-wide px-2 py-1 truncate">Access</span></p>
          )}
          {(canSeeUsers || canManageRoles) && (
            <SidePaneButton icon="🔐" label={canSeeUsers && canManageRoles ? 'Users & Roles' : canManageRoles ? 'Roles & Permissions' : 'Users'}
              mode={mode} active={activeView === 'users' || activeView === 'roles'} onClick={() => pickLossView('users')} />
          )}
          {canViewPortalAs && (
            <SidePaneButton icon="👁" label="View Portal As" mode={mode} divider={canSeeUsers || canManageRoles}
              active={activeView === 'viewPortalAs'} onClick={() => pickLossView('viewPortalAs')} />
          )}
          {canManageRoles && (
            <SidePaneButton icon="↕️" label="Reorder & Rename Lists" mode={mode} divider={canSeeUsers || canManageRoles || canViewPortalAs}
              active={activeView === 'reorderLists'} onClick={() => pickLossView('reorderLists')} />
          )}
          {canManageRoles && (
            <SidePaneButton icon="⏱️" label="Activity Times" mode={mode} divider
              active={activeView === 'activityDurations'} onClick={() => pickLossView('activityDurations')} />
          )}
        </div>
      )}
    </>
  )
}
