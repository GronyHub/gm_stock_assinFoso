'use client'
import { useState } from 'react'
import {
  TimesTab, PayslipsTab, ViolationsTab, AnalyticsTab, AssignmentsTab, RotaTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
import { SidePaneContainer, SidePaneToggle, SidePaneButton, useSidePaneDisplayMode } from './SidePane'

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

type BuilderLevel = 'top' | 'personal' | 'othersList' | 'othersPerson' | 'build' | 'allStaff'

const TOP_ITEMS = [
  { key: 'personal', label: 'Personal', icon: '🙋' },
  { key: 'others', label: 'Others', icon: '👥' },
  { key: 'build', label: 'Build', icon: '🛠️' },
  { key: 'allStaff', label: 'All Staff', icon: '🏢' },
] as const

// Joe/Grony's page. Deliberately ONE pane at a time, not one pane per
// navigation level stacked side by side -- on a phone that ate the entire
// screen width and left no room for content at all. Picking "Others" (or
// "Build") swaps the same pane's contents for that level's list instead of
// opening a second pane next to it; a "← Back" entry at the top steps back
// out one level, same as a drill-down list in a settings app. Personal is
// the default landing (Times shown first), matching the old default.
function BuilderStaffTabs({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const others = ALL_STAFF_NAMES.filter(n => n.toLowerCase() !== staffName.toLowerCase())
  const [level, setLevel] = useState<BuilderLevel>('personal')
  const [selectedOther, setSelectedOther] = useState(others[0])
  const [tab, setTab] = useState<ViewTab>('Times')
  const [buildTab, setBuildTab] = useState<'Payslips' | 'Rota'>('Payslips')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')
  const [teamVtab, setTeamVtab] = useState<ViolationView>('Disciplinary')
  const [mode, changeMode] = useSidePaneDisplayMode()

  const isSelf = level !== 'othersPerson'
  const viewingName = isSelf ? staffName : selectedOther
  const viewTabs: { key: ViewTab; icon: string }[] = isSelf ? [...VIEW_TABS, { key: 'Profile', icon: '👤' }] : [...VIEW_TABS]

  return (
    <div className="flex h-full min-h-0">
      <SidePaneContainer mode={mode}>
        <SidePaneToggle mode={mode} onChange={changeMode} />

        {level === 'top' && TOP_ITEMS.map(t => (
          <SidePaneButton key={t.key} icon={t.icon} label={t.label} mode={mode} active={false}
            onClick={() => setLevel(t.key === 'personal' ? 'personal' : t.key === 'others' ? 'othersList' : t.key === 'build' ? 'build' : 'allStaff')} />
        ))}

        {level !== 'top' && (
          <SidePaneButton icon="←" label="Back" mode={mode} active={false}
            onClick={() => setLevel(level === 'othersPerson' ? 'othersList' : 'top')} />
        )}

        {(level === 'personal' || level === 'othersPerson') && viewTabs.map(t => (
          <SidePaneButton key={t.key} icon={t.icon} label={t.key} mode={mode}
            active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}

        {level === 'othersList' && others.map(name => (
          <SidePaneButton key={name} icon="👤" label={name} mode={mode} active={false}
            onClick={() => { setSelectedOther(name); setTab('Times'); setVtab('Disciplinary'); setLevel('othersPerson') }} />
        ))}

        {level === 'build' && (<>
          <SidePaneButton icon="💵" label="Payslips" mode={mode} active={buildTab === 'Payslips'} onClick={() => setBuildTab('Payslips')} />
          <SidePaneButton icon="🗓️" label="Rota" mode={mode} active={buildTab === 'Rota'} onClick={() => setBuildTab('Rota')} />
        </>)}
      </SidePaneContainer>

      <div className="flex-1 min-w-0 overflow-y-auto px-2 py-3">
        {level === 'top' && <p className="text-center text-gray-400 text-sm py-10">Pick a section on the left.</p>}
        {(level === 'personal' || level === 'othersPerson') && (<>
          {tab === 'Times' && <TimesTab username={username} role={role} openAddSignal={isSelf ? openAddSignal : undefined} />}
          {tab === 'Payslips' && <PayslipsTab role={role} username={username} viewingStaff={viewingName} />}
          {tab === 'Violations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} viewingStaff={viewingName} />}
          {tab === 'Analytics' && <AnalyticsTab viewingStaff={viewingName} />}
          {tab === 'Assignments' && <AssignmentsTab role={role} username={username} viewingStaff={viewingName} />}
          {tab === 'Profile' && isSelf && <ProfileTab />}
        </>)}
        {level === 'othersList' && <p className="text-center text-gray-400 text-sm py-10">Pick a name on the left.</p>}
        {level === 'build' && (<>
          {buildTab === 'Payslips' && <PayslipsTab role={role} username={username} />}
          {buildTab === 'Rota' && <RotaTab canManage={true} />}
        </>)}
        {level === 'allStaff' && <ViolationsTab role={role} username={username} vtab={teamVtab} setVtab={setTeamVtab} />}
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
