'use client'
import { useState } from 'react'
import {
  TimesTab, PayslipsTab, ViolationsTab, RoleTab, AnalyticsTab, AssignmentsTab,
} from '../../staff/StaffClient'
import type { ViolationView } from '../../staff/StaffClient'

// One staff member's own slice of Times/Payslips/Violations/Role/Analytics/
// Assignments -- each Tab already fetches everyone's data and filters
// client-side, so `viewingStaff` just locks each one to this name instead
// of duplicating any of that logic. Rota isn't here: it's a shared weekly
// schedule across everyone, not one person's record (see Grony Manage).
const PERSON_TABS = ['Times', 'Payslips', 'Violations', 'Role', 'Analytics', 'Assignments'] as const
type PersonTab = (typeof PERSON_TABS)[number]

export default function StaffPersonTab({ staffName, role, username, openAddSignal }: {
  staffName: string; role: string; username: string; openAddSignal?: number
}) {
  const [tab, setTab] = useState<PersonTab>('Times')
  const [vtab, setVtab] = useState<ViolationView>('Disciplinary')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {PERSON_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 text-sm font-semibold px-1.5 py-0.5 rounded-lg whitespace-nowrap border transition
              ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        {tab === 'Times' && <TimesTab username={username} role={role} openAddSignal={openAddSignal} viewingStaff={staffName} />}
        {tab === 'Payslips' && <PayslipsTab role={role} username={username} viewingStaff={staffName} />}
        {tab === 'Violations' && <ViolationsTab role={role} username={username} vtab={vtab} setVtab={setVtab} viewingStaff={staffName} />}
        {tab === 'Role' && <RoleTab role={role} username={username} viewingStaff={staffName} />}
        {tab === 'Analytics' && <AnalyticsTab viewingStaff={staffName} />}
        {tab === 'Assignments' && <AssignmentsTab role={role} username={username} viewingStaff={staffName} />}
      </div>
    </div>
  )
}
