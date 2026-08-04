'use client'
import { SidePaneButton, type DisplayMode } from './SidePane'
import { STAFF_ADMIN_TEAM_ITEMS, type StaffView } from './staffViewData'

// Everything only Joe/Grony (or a role granted one of these) can do, in one
// place -- previously these sat inline in the main pane at all times
// (Viewing picker, Team, Users, View Portal As), making an owner's own
// day-to-day pane noticeably longer than everyone else's.
// Reached via the main pane's own Settings button, which toggles this as a
// second pane alongside it (see item/page.tsx's settingsOpen block) --
// styled and behaving the same as any other left pane (SidePaneButton rows,
// same dark background) rather than a full-screen takeover, so switching
// between "normal navigation" and "Settings navigation" is just picking a
// row on either side, not leaving and re-entering a whole different screen.
type SettingsDestination = StaffView | 'viewPortalAs' | 'reorderLists'

type Props = {
  mode: DisplayMode
  activeView: string
  viewingName: string
  myStaffName: string | undefined
  staffRoster: string[]
  pickViewing: (name: string) => void
  pickLossView: (view: SettingsDestination, opts?: { keepSettingsOpen?: boolean }) => void
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
    <div className={`${mode === 'icon' ? 'w-14' : mode === 'text' ? 'w-14 sm:w-32' : 'w-14 sm:w-28'} shrink-0 border-r border-white/10 bg-[#00072d] flex flex-col min-h-0`}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {mode !== 'icon' && (
          <p className="px-2 pt-2 pb-1 text-[10px] font-bold text-white uppercase tracking-wide">⚙️ Settings</p>
        )}

        {/* Team moved out into its own labeled section in the main pane
            (alongside Cash/Manage/Personal) instead of hiding behind this
            gear icon -- this is now just the name switcher for Personal. */}
        {myStaffName && (
          <div className="mt-1 pt-1 border-t border-white/10">
            {mode !== 'icon' && (
              <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">Viewing</p>
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
          <div className="mt-1 pt-1 border-t border-white/10">
            {mode !== 'icon' && (
              <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">Team</p>
            )}
            {STAFF_ADMIN_TEAM_ITEMS.map((t, i) => (
              <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={mode} divider={i > 0}
                active={activeView === t.key} onClick={() => pickLossView(t.key, { keepSettingsOpen: true })} />
            ))}
          </div>
        )}

        {(canSeeUsers || canManageRoles || canViewPortalAs) && (
          <div className="mt-1 pt-1 border-t border-white/10">
            {mode !== 'icon' && (
              <p className="px-2 pt-1 pb-0.5 text-[8px] font-bold text-blue-200 uppercase tracking-wide">Access</p>
            )}
            {(canSeeUsers || canManageRoles) && (
              <SidePaneButton icon="🔐" label={canSeeUsers && canManageRoles ? 'Users & Roles' : canManageRoles ? 'Roles & Permissions' : 'Users'}
                mode={mode} active={activeView === 'users' || activeView === 'roles'} onClick={() => pickLossView('users', { keepSettingsOpen: true })} />
            )}
            {canViewPortalAs && (
              <SidePaneButton icon="👁" label="View Portal As" mode={mode} divider={canSeeUsers || canManageRoles}
                active={activeView === 'viewPortalAs'} onClick={() => pickLossView('viewPortalAs', { keepSettingsOpen: true })} />
            )}
            {canManageRoles && (
              <SidePaneButton icon="↕️" label="Reorder Lists" mode={mode} divider={canSeeUsers || canManageRoles || canViewPortalAs}
                active={activeView === 'reorderLists'} onClick={() => pickLossView('reorderLists', { keepSettingsOpen: true })} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
