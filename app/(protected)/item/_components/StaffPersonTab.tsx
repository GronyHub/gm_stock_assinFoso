'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { signOut } from 'next-auth/react'
import {
  TimesTab, PayslipsTab, ViolationsTab, AnalyticsTab, AssignmentsTab, RotaTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './SidePane'

// Same lazy hamburger-menu widget Grony Cash's account menu uses -- it
// already self-gates to owner-level (Grony/Joe) and hides itself while
// already impersonating, so dropping it into every staff pane unconditionally
// is safe: it simply renders nothing for anyone else.
const ViewPortalAsButton = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })
// Users lives at /users as its own page/route, but pulled in and rendered
// inline here (like VendorsPage/CustomersPage are inside Grony Cash) so
// picking it from Joe/Grony's left pane keeps this tab's shell up instead
// of navigating away.
const UsersPage = dynamic(() => import('../../users/page'), {
  ssr: false, loading: () => <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>,
})

// Bottom-of-pane block every staff person's left pane ends with, regardless
// of which level/tab is currently showing above it -- View Portal As
// (no-op unless you're owner-level) then Sign Out, same order the old
// hamburger menu used.
function PaneFooter({ mode }: { mode: import('./SidePane').DisplayMode }) {
  return (
    <div className="mt-1 border-t border-blue-700 pt-1">
      <ViewPortalAsButton />
      <SidePaneButton icon="🚪" label="Sign out" mode={mode} active={false}
        onClick={() => signOut({ callbackUrl: '/login' })} />
    </div>
  )
}

const VIEW_TABS = [
  { key: 'Times', icon: '🕐' },
  { key: 'Payslips', icon: '💵' },
  { key: 'Violations', icon: '⚠️' },
  { key: 'Analytics', icon: '📊' },
  { key: 'Assignments', icon: '📋' },
] as const
type ViewTab = (typeof VIEW_TABS)[number]['key'] | 'Profile'

// The standard page every regular staff member has -- a single left pane,
// same shape as Grony Manage's (one pane, no nesting). Times is shared and
// unfiltered (everyone sees the whole team's clock records, plus an
// upcoming-schedule preview built from the rota -- see TimesTab itself),
// Payslips/Violations/Analytics/Assignments are locked to `staffName` via
// viewingStaff. Profile only shows up when this really is your own page --
// it edits login credentials off the session itself.
function StandardStaffTabs({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const isSelf = staffName.toLowerCase() === username.toLowerCase()
  const tabs: { key: ViewTab; icon: string }[] = isSelf ? [...VIEW_TABS, { key: 'Profile', icon: '👤' }] : [...VIEW_TABS]
  const [tab, setTab] = useState<ViewTab>('Times')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')
  const [mode, changeMode] = useSidePaneDisplayMode()

  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={changeMode} />
        {tabs.map(t => (
          <SidePaneButton key={t.key} icon={t.icon} label={t.key} mode={mode}
            active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
        <PaneFooter mode={mode} />
      </SidePaneContainer>
      <div className="flex-1 min-w-0 overflow-y-auto px-2 py-3">
        {tab === 'Times' && <TimesTab username={username} role={role} openAddSignal={openAddSignal} />}
        {tab === 'Payslips' && <PayslipsTab role={role} username={username} viewingStaff={staffName} />}
        {tab === 'Violations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} viewingStaff={staffName} />}
        {tab === 'Analytics' && <AnalyticsTab viewingStaff={staffName} />}
        {tab === 'Assignments' && <AssignmentsTab role={role} username={username} viewingStaff={staffName} />}
        {tab === 'Profile' && isSelf && <ProfileTab />}
      </div>
    </div>
  )
}

type BuilderTab = ViewTab | 'TeamPayslips' | 'Rota' | 'AllStaff' | 'Users'

const TEAM_ITEMS: { key: BuilderTab; label: string; icon: string }[] = [
  { key: 'TeamPayslips', label: 'Team Payslips', icon: '💵' },
  { key: 'Rota',         label: 'Rota',          icon: '🗓️' },
  { key: 'AllStaff',     label: 'All Staff',     icon: '🏢' },
]

// Joe/Grony's page. One flat, always-visible list -- no drill-down levels
// and no "← Back" button to step back out of one. "Viewing" (who the
// person-scoped tabs below it apply to) and the tabs themselves are two
// independent choices sitting side by side in the same pane, rather than
// picking a person hiding everything else the way the old
// Personal/Others/Build/All Staff levels did.
function BuilderStaffTabs({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const others = ALL_STAFF_NAMES.filter(n => n.toLowerCase() !== staffName.toLowerCase())
  const [viewingName, setViewingName] = useState(staffName)
  const [tab, setTab] = useState<BuilderTab>('Times')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')
  const [teamVtab, setTeamVtab] = useState<ViolationView>('Disciplinary')
  const [mode, changeMode] = useSidePaneDisplayMode()

  const isSelf = viewingName.toLowerCase() === staffName.toLowerCase()

  // Profile only ever means "my own login" -- switching to someone else's
  // name while it's showing has nowhere sensible to land, so fall back to
  // Times instead of leaving the content area blank.
  function pickViewing(name: string) {
    setViewingName(name)
    if (tab === 'Profile' && name.toLowerCase() !== staffName.toLowerCase()) setTab('Times')
  }

  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={changeMode} />

        {mode !== 'icon' && <p className="px-2 pt-2 pb-0.5 text-[9px] font-bold text-blue-200 uppercase tracking-wide">Viewing</p>}
        <SidePaneButton icon="🙋" label="Me" mode={mode} active={isSelf} onClick={() => pickViewing(staffName)} />
        {others.map(name => (
          <SidePaneButton key={name} icon="👤" label={name} mode={mode}
            active={viewingName === name} onClick={() => pickViewing(name)} />
        ))}

        <div className="mt-1 pt-1 border-t border-blue-700">
          {VIEW_TABS.map(t => (
            <SidePaneButton key={t.key} icon={t.icon} label={t.key} mode={mode}
              active={tab === t.key} onClick={() => setTab(t.key)} />
          ))}
          {isSelf && (
            <SidePaneButton icon="👤" label="Profile" mode={mode} active={tab === 'Profile'} onClick={() => setTab('Profile')} />
          )}
        </div>

        <div className="mt-1 pt-1 border-t border-blue-700">
          {mode !== 'icon' && <p className="px-2 pb-0.5 text-[9px] font-bold text-blue-200 uppercase tracking-wide">Team</p>}
          {TEAM_ITEMS.map(t => (
            <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={mode}
              active={tab === t.key} onClick={() => setTab(t.key)} />
          ))}
        </div>

        <div className="mt-1 pt-1 border-t border-blue-700">
          <SidePaneButton icon="🔑" label="Users" mode={mode} active={tab === 'Users'} onClick={() => setTab('Users')} />
        </div>

        <PaneFooter mode={mode} />
      </SidePaneContainer>

      <div className="flex-1 min-w-0 overflow-y-auto px-2 py-3">
        {tab === 'Times' && <TimesTab username={username} role={role} openAddSignal={isSelf ? openAddSignal : undefined} />}
        {tab === 'Payslips' && <PayslipsTab role={role} username={username} viewingStaff={viewingName} />}
        {tab === 'Violations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} viewingStaff={viewingName} />}
        {tab === 'Analytics' && <AnalyticsTab viewingStaff={viewingName} />}
        {tab === 'Assignments' && <AssignmentsTab role={role} username={username} viewingStaff={viewingName} />}
        {tab === 'Profile' && isSelf && <ProfileTab />}
        {tab === 'TeamPayslips' && <PayslipsTab role={role} username={username} />}
        {tab === 'Rota' && <RotaTab canManage={true} />}
        {tab === 'AllStaff' && <ViolationsTab role={role} username={username} vtab={teamVtab} setVtab={setTeamVtab} />}
        {tab === 'Users' && <UsersPage />}
      </div>
    </div>
  )
}

export default function StaffPersonTab({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const isBuilder = ['joe', 'grony'].includes(staffName.toLowerCase())
  if (isBuilder) {
    return <BuilderStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} />
  }
  return <StandardStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} />
}
