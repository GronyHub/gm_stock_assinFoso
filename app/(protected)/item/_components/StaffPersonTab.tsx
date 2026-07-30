'use client'
import { useState } from 'react'
import {
  TimesTab, PayslipsTab, ViolationsTab, AnalyticsTab, AssignmentsTab, RotaTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './SidePane'
import type { DisplayMode } from './SidePane'

const STANDARD_TABS = [
  { key: 'Times', icon: '🕐' },
  { key: 'Payslips', icon: '💵' },
  { key: 'Violations', icon: '⚠️' },
  { key: 'Analytics', icon: '📊' },
  { key: 'Assignments', icon: '📋' },
] as const
type StandardTab = (typeof STANDARD_TABS)[number]['key'] | 'Profile'

// The standard page every staff member has: Times is shared and unfiltered
// (everyone sees the whole team's clock records, plus an upcoming-schedule
// preview built from the rota -- see TimesTab itself), Payslips/Violations/
// Analytics/Assignments are locked to `staffName` via viewingStaff. Reused
// for a regular staff member's whole page, and for Joe/Grony's own
// "Personal" tab and "Others" tab (once they've picked which other person
// to look at). There's no separate Rota tab here -- actually building/
// editing it lives in Build only; everyone just sees it read-only inside
// Times. Profile only shows up when this really is your own page -- it
// edits login credentials off the session itself, not a viewingStaff param,
// so under "Others" it would otherwise show YOUR profile mislabeled as
// theirs. `mode`/`onModeChange` come from whichever ancestor owns the
// display-mode preference (see SidePane) so every left pane on the page
// stays in sync.
function StandardStaffTabs({ staffName, role, username, openAddSignal, mode, onModeChange }: {
  staffName: string; role: string; username: string; openAddSignal?: number
  mode: DisplayMode; onModeChange: (mode: DisplayMode) => void
}) {
  const isSelf = staffName.toLowerCase() === username.toLowerCase()
  const tabs: { key: StandardTab; icon: string }[] = isSelf ? [...STANDARD_TABS, { key: 'Profile', icon: '👤' }] : [...STANDARD_TABS]
  const [tab, setTab] = useState<StandardTab>('Times')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')

  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={onModeChange} />
        {tabs.map(t => (
          <SidePaneButton key={t.key} icon={t.icon} label={t.key} mode={mode}
            active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
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

// Joe/Grony only -- pick any other staff member and see their standard page,
// same shape as "Personal" but for someone else. `key={selected}` forces a
// clean remount on each pick so StandardStaffTabs' own state (which sub-tab,
// its Violations vtab) doesn't carry over stale from the previous person.
function OthersTab({ role, username, selfName, mode, onModeChange }: {
  role: string; username: string; selfName: string
  mode: DisplayMode; onModeChange: (mode: DisplayMode) => void
}) {
  const others = ALL_STAFF_NAMES.filter(n => n.toLowerCase() !== selfName.toLowerCase())
  const [selected, setSelected] = useState(others[0])

  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={onModeChange} />
        {others.map(name => (
          <SidePaneButton key={name} icon="👤" label={name} mode={mode}
            active={selected === name} onClick={() => setSelected(name)} />
        ))}
      </SidePaneContainer>
      <div className="flex-1 min-w-0 min-h-0">
        <StandardStaffTabs key={selected} staffName={selected} role={role} username={username} mode={mode} onModeChange={onModeChange} />
      </div>
    </div>
  )
}

// Joe/Grony only -- the tools that populate what shows up in everyone's
// (including their own) Payslips/Rota. This is the only place Rota is
// actually editable; Personal/Others both show it read-only. Tasks isn't
// here -- it's being redesigned as a section inside each Grony Manage
// category itself rather than one central builder, so it's pulled out of
// here for now.
function BuildTab({ role, username, mode, onModeChange }: {
  role: string; username: string
  mode: DisplayMode; onModeChange: (mode: DisplayMode) => void
}) {
  const [tab, setTab] = useState<'Payslips' | 'Rota'>('Payslips')
  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={onModeChange} />
        <SidePaneButton icon="💵" label="Payslips" mode={mode} active={tab === 'Payslips'} onClick={() => setTab('Payslips')} />
        <SidePaneButton icon="🗓️" label="Rota" mode={mode} active={tab === 'Rota'} onClick={() => setTab('Rota')} />
      </SidePaneContainer>
      <div className="flex-1 min-w-0 overflow-y-auto px-2 py-3">
        {tab === 'Payslips' && <PayslipsTab role={role} username={username} />}
        {tab === 'Rota' && <RotaTab canManage={true} />}
      </div>
    </div>
  )
}

const BUILDER_TOP_TABS = [
  { key: 'Personal', icon: '🙋' },
  { key: 'Others', icon: '👥' },
  { key: 'Build', icon: '🛠️' },
  { key: 'All Staff', icon: '🏢' },
] as const
type BuilderTopTab = (typeof BUILDER_TOP_TABS)[number]['key']

// Joe/Grony's page: 4 top-level entries instead of everyone else's flat 6 --
// Personal (their own standard page), Others (anyone else's standard page),
// Build (the payslip/rota admin tools), and All Staff (the shop-wide
// violations leaderboard/checklist, kept as its own entry for now rather
// than folded into Build). Owns the one display-mode preference for this
// whole page and threads it down so every nested left pane (Others' name
// picker, Build's own list, the nested Personal/Others standard tabs) stays
// in lockstep with this top one.
function BuilderStaffTabs({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const [topTab, setTopTab] = useState<BuilderTopTab>('Personal')
  const [teamVtab, setTeamVtab] = useState<ViolationView>('Disciplinary')
  const [mode, changeMode] = useSidePaneDisplayMode()

  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={changeMode} />
        {BUILDER_TOP_TABS.map(t => (
          <SidePaneButton key={t.key} icon={t.icon} label={t.key} mode={mode}
            active={topTab === t.key} onClick={() => setTopTab(t.key)} />
        ))}
      </SidePaneContainer>
      <div className="flex-1 min-w-0 min-h-0">
        {topTab === 'Personal' && <StandardStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} mode={mode} onModeChange={changeMode} />}
        {topTab === 'Others' && <OthersTab role={role} username={username} selfName={staffName} mode={mode} onModeChange={changeMode} />}
        {topTab === 'Build' && <BuildTab role={role} username={username} mode={mode} onModeChange={changeMode} />}
        {topTab === 'All Staff' && <ViolationsTab role={role} username={username} vtab={teamVtab} setVtab={setTeamVtab} />}
      </div>
    </div>
  )
}

export default function StaffPersonTab({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const isBuilder = ['joe', 'grony'].includes(staffName.toLowerCase())
  const [mode, changeMode] = useSidePaneDisplayMode()
  if (isBuilder) {
    return <BuilderStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} />
  }
  return <StandardStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} mode={mode} onModeChange={changeMode} />
}
