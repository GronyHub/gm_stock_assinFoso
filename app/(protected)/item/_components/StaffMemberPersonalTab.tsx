'use client'
import { useState, useEffect } from 'react'
import ManageLogPanel from './ManageLogPanel'
import DressCodeFlagsPanel from './DressCodeFlagsPanel'
import StaffMeetingPanel from './StaffMeetingPanel'
import StaffTimesView from './StaffTimesView'
import ProfileTab from './ProfileTab'
import SupervisorClockOut from './SupervisorClockOut'
import { PenaltyCard } from '@/components/PenaltyChip'
import { PayslipsTab } from '../../staff/StaffClient'

export type TabKey = 'times' | 'violations' | 'payslips' | 'profile' | 'tasks' | 'dressCode' | 'meeting'

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'times', icon: '🕐', label: 'Times' },
  { key: 'violations', icon: '⚖', label: 'Violations' },
  { key: 'payslips', icon: '💵', label: 'Payslips' },
  { key: 'profile', icon: '👤', label: 'Profile' },
  { key: 'tasks', icon: '✅', label: 'Tasks' },
  { key: 'dressCode', icon: '👕', label: 'Dress Code' },
  { key: 'meeting', icon: '🗣️', label: 'Meeting' },
]

export default function StaffMemberPersonalTab({
  staffName, username, role, canManage, staffRoster, routablePages, categoryIds, initialTab,
}: {
  staffName: string
  username: string
  role: string
  canManage: boolean
  staffRoster: string[]
  routablePages: string[]
  categoryIds: Record<string, number>
  // Defaults to Tasks (the pane's own "Staff Members" row still lands
  // there), but PresentStaffBar/StaffMemberModal opens straight onto Times
  // instead, since that's specifically what tapping a name there is for.
  initialTab?: TabKey
}) {
  // Payslips and Profile belong to one person: only their own page shows them.
  const isSelf = staffName.toLowerCase() === username.toLowerCase()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'tasks')
  const [tasksData, setTasksData] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  // Fetch tasks assigned to this staff member
  useEffect(() => {
    if (activeTab !== 'tasks') return
    setTasksLoading(true)
    fetch(`/api/tasks?assigned_to=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        setTasksData(Array.isArray(d) ? d : [])
        setTasksLoading(false)
      })
      .catch(() => setTasksLoading(false))
  }, [staffName, activeTab])

  function TasksView() {
    return (
      <div>
        {tasksLoading ? (
          <div className="text-center text-gray-400 py-4 text-sm">Loading tasks...</div>
        ) : tasksData.length === 0 ? (
          <div className="text-center text-gray-400 py-4 text-sm">No tasks assigned</div>
        ) : (
          <div className="space-y-2">
            {tasksData.map((task: any) => (
              <div key={task.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="font-medium text-gray-900">{task.title}</div>
                {task.notes && <div className="text-sm text-gray-600 mt-1">{task.notes}</div>}
                {task.due_date && <div className="text-xs text-gray-500 mt-1">Due: {task.due_date}</div>}
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={!!task.done} disabled={!isSelf && !canManage} className="w-5 h-5" onChange={() => {
                    setTasksData(prev => prev.map((x: any) => x.id === task.id ? { ...x, done: !x.done } : x))
                    void fetch(`/api/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !task.done }) }).catch(() => {})
                  }} />
                  <span className="text-xs text-gray-600">{task.done ? 'Done' : 'Tap the box when it is done'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-2 pt-2 space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.filter(t => (isSelf || (t.key !== 'payslips' && t.key !== 'profile')) && (t.key !== 'violations' || isSelf || canManage)).map(t => (
          <button key={t.key} type="button" ref={el => { if (el && activeTab === t.key) el.scrollIntoView({ inline: 'center', block: 'nearest' }) }} onClick={() => setActiveTab(t.key)}
            className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        {activeTab === 'times' && !isSelf && <SupervisorClockOut staffName={staffName} />}
        {activeTab === 'times' && <div className="p-3"><StaffTimesView staffName={staffName} username={username} /></div>}
        {activeTab === 'violations' && (
          <div className="space-y-3 p-2">
            <PenaltyCard staff={isSelf ? undefined : staffName} />
            <div className="rounded-xl border border-gray-200 p-3"><ManageLogPanel category="team_behaviour_log" label="Behaviour incidents logged by managers" icon="🚦" filterAboutStaff={staffName} /></div>
            <div className="rounded-xl border border-gray-200 p-3"><ManageLogPanel category="staff_display" label="Display incidents logged by managers" icon="📌" filterAboutStaff={staffName} /></div>
          </div>
        )}
        {activeTab === 'payslips' && isSelf && <div className="p-2"><PayslipsTab role={role} username={username} viewingStaff={staffName} /></div>}
        {activeTab === 'profile' && isSelf && <div className="p-2"><ProfileTab /></div>}
        {activeTab === 'tasks' && <div className="p-3"><TasksView /></div>}
        {activeTab === 'dressCode' && <DressCodeFlagsPanel filterStaff={staffName} />}
        {activeTab === 'meeting' && (
          <div className="p-3"><StaffMeetingPanel staffRoster={staffRoster} routablePages={routablePages} filterStaff={staffName} /></div>
        )}
      </div>
    </div>
  )
}
