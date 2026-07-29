'use client'
import { useState } from 'react'
import {
  TimesTab, PayslipsTab, ViolationsTab, RoleTab, AnalyticsTab, AssignmentsTab, RotaTab,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'

// Personal tabs -- each Tab already fetches everyone's data and filters
// client-side, so `viewingStaff` just locks each one to this name instead
// of duplicating any of that logic.
const PERSONAL_TABS = ['Payslips', 'Violations', 'Role', 'Analytics', 'Assignments'] as const
type PersonalTab = (typeof PERSONAL_TABS)[number]
// Shared tabs -- Times and Rota show the whole team's structure, not just
// this person's slice, even on their own page (everyone can see who else is
// clocked in / scheduled).
type SharedTab = 'Times' | 'Rota' | 'Rota Builder'
// Joe and Grony additionally get the shop-wide admin tools that used to live
// on the old roster-picker's "Team" section -- Payslip Builder covers all of
// By Month/By Staff/Profiles/Flags/Build (it's the same unfiltered
// PayslipsTab, which already has its own view switcher for those), and All
// Staff covers the shop-wide Violations checklist/leaderboard.
type BuilderTab = 'Payslip Builder' | 'All Staff'
type PersonTab = PersonalTab | SharedTab | BuilderTab

export default function StaffPersonTab({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const isBuilder = ['joe', 'grony'].includes(staffName.toLowerCase())
  const rotaLabel: SharedTab = isBuilder ? 'Rota Builder' : 'Rota'
  const tabs: PersonTab[] = [
    'Times', ...PERSONAL_TABS, rotaLabel,
    ...(isBuilder ? (['Payslip Builder', 'All Staff'] as const) : []),
  ]

  const [tab, setTab] = useState<PersonTab>('Times')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')
  const [teamVtab, setTeamVtab] = useState<ViolationView>('Disciplinary')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 text-sm font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border transition
              ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        {tab === 'Times' && <TimesTab username={username} role={role} openAddSignal={openAddSignal} />}
        {tab === 'Payslips' && <PayslipsTab role={role} username={username} viewingStaff={staffName} />}
        {tab === 'Violations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} viewingStaff={staffName} />}
        {tab === 'Role' && <RoleTab role={role} username={username} viewingStaff={staffName} />}
        {tab === 'Analytics' && <AnalyticsTab viewingStaff={staffName} />}
        {tab === 'Assignments' && <AssignmentsTab role={role} username={username} viewingStaff={staffName} />}
        {(tab === 'Rota' || tab === 'Rota Builder') && <RotaTab />}
        {tab === 'Payslip Builder' && <PayslipsTab role={role} username={username} />}
        {tab === 'All Staff' && <ViolationsTab role={role} username={username} vtab={teamVtab} setVtab={setTeamVtab} />}
      </div>
    </div>
  )
}
