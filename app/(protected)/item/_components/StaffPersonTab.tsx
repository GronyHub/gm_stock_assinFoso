'use client'
import { useState } from 'react'
import {
  TimesTab, PayslipsTab, ViolationsTab, AnalyticsTab, AssignmentsTab, RotaTab, ALL_STAFF_NAMES,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'
import ProfileTab from './ProfileTab'
import CustomTasksSection from './CustomTasksSection'

const STANDARD_TABS = ['Times', 'Payslips', 'Violations', 'Analytics', 'Assignments'] as const
type StandardTab = (typeof STANDARD_TABS)[number] | 'Profile'

const tabBtnCls = (active: boolean) =>
  `shrink-0 text-sm font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border transition
    ${active ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`

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
// theirs.
function StandardStaffTabs({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const isSelf = staffName.toLowerCase() === username.toLowerCase()
  const tabs: StandardTab[] = isSelf ? [...STANDARD_TABS, 'Profile'] : [...STANDARD_TABS]
  const [tab, setTab] = useState<StandardTab>('Times')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={tabBtnCls(tab === t)}>{t}</button>)}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
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
function OthersTab({ role, username, selfName }: { role: string; username: string; selfName: string }) {
  const others = ALL_STAFF_NAMES.filter(n => n.toLowerCase() !== selfName.toLowerCase())
  const [selected, setSelected] = useState(others[0])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-100 overflow-x-auto shrink-0">
        {others.map(name => (
          <button key={name} onClick={() => setSelected(name)}
            className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition
              ${selected === name ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
            {name}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <StandardStaffTabs key={selected} staffName={selected} role={role} username={username} />
      </div>
    </div>
  )
}

// Joe/Grony only -- the tools that populate what shows up in everyone's
// (including their own) Payslips/Rota/Tasks. This is the only place Rota is
// actually editable (Personal/Others both show it read-only), and the only
// place a new task gets created -- it still shows up (and gets toggled/
// edited/deleted) in the bottom Tasks panel exactly as before, same as a
// built payslip shows up in Payslips and a built shift shows up in the
// Upcoming Schedule.
function BuildTab({ role, username, taskSubmenus }: {
  role: string; username: string; taskSubmenus: { label: string }[]
}) {
  const [tab, setTab] = useState<'Payslips' | 'Rota' | 'Tasks'>('Payslips')
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 shrink-0">
        <button onClick={() => setTab('Payslips')} className={tabBtnCls(tab === 'Payslips')}>Payslips</button>
        <button onClick={() => setTab('Rota')} className={tabBtnCls(tab === 'Rota')}>Rota</button>
        <button onClick={() => setTab('Tasks')} className={tabBtnCls(tab === 'Tasks')}>Tasks</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        {tab === 'Payslips' && <PayslipsTab role={role} username={username} />}
        {tab === 'Rota' && <RotaTab canManage={true} />}
        {tab === 'Tasks' && <CustomTasksSection submenus={taskSubmenus} onAdded={() => {}} />}
      </div>
    </div>
  )
}

const BUILDER_TOP_TABS = ['Personal', 'Others', 'Build', 'All Staff'] as const
type BuilderTopTab = (typeof BUILDER_TOP_TABS)[number]

// Joe/Grony's page: 4 top-level tabs instead of everyone else's flat 6 --
// Personal (their own standard page), Others (anyone else's standard page),
// Build (the payslip/rota admin tools), and All Staff (the shop-wide
// violations leaderboard/checklist, kept as its own tab for now rather than
// folded into Build).
function BuilderStaffTabs({ staffName, role, username, openAddSignal, taskSubmenus }: {
  staffName: string; role: string; username: string; openAddSignal?: number; taskSubmenus: { label: string }[]
}) {
  const [topTab, setTopTab] = useState<BuilderTopTab>('Personal')
  const [teamVtab, setTeamVtab] = useState<ViolationView>('Disciplinary')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {BUILDER_TOP_TABS.map(t => <button key={t} onClick={() => setTopTab(t)} className={tabBtnCls(topTab === t)}>{t}</button>)}
      </div>
      <div className="flex-1 min-h-0">
        {topTab === 'Personal' && <StandardStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} />}
        {topTab === 'Others' && <OthersTab role={role} username={username} selfName={staffName} />}
        {topTab === 'Build' && <BuildTab role={role} username={username} taskSubmenus={taskSubmenus} />}
        {topTab === 'All Staff' && <ViolationsTab role={role} username={username} vtab={teamVtab} setVtab={setTeamVtab} />}
      </div>
    </div>
  )
}

export default function StaffPersonTab({ staffName, role, username, openAddSignal, taskSubmenus }: {
  staffName: string; role: string; username: string; openAddSignal?: number; taskSubmenus: { label: string }[]
}) {
  const isBuilder = ['joe', 'grony'].includes(staffName.toLowerCase())
  if (isBuilder) {
    return <BuilderStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} taskSubmenus={taskSubmenus} />
  }
  return <StandardStaffTabs staffName={staffName} role={role} username={username} openAddSignal={openAddSignal} />
}
