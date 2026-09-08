'use client'
import { useState, useEffect } from 'react'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import DressCodeFlagsPanel from './DressCodeFlagsPanel'
import ClosingReportLogView from './ClosingReportLogView'
import AssessmentPanel from './AssessmentPanel'
import StaffMeetingPanel from './StaffMeetingPanel'

type TabKey = 'tasks' | 'mentions' | 'dressCode' | 'training' | 'behaviour' | 'assessment' | 'meeting' | 'display' | 'laws'

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'tasks', icon: '✅', label: 'Tasks' },
  { key: 'mentions', icon: '🔍', label: 'Mentions' },
  { key: 'dressCode', icon: '👕', label: 'Dress Code' },
  { key: 'training', icon: '📖', label: 'Training' },
  { key: 'behaviour', icon: '🚦', label: 'Behaviour' },
  { key: 'assessment', icon: '📝', label: 'Assessment' },
  { key: 'meeting', icon: '🗣️', label: 'Meeting' },
  { key: 'display', icon: '📌', label: 'Display' },
  { key: 'laws', icon: '⚖️', label: 'Laws' },
]

export default function StaffMemberPersonalTab({
  staffName, username, role, canManage, staffRoster, routablePages, categoryIds,
}: {
  staffName: string
  username: string
  role: string
  canManage: boolean
  staffRoster: string[]
  routablePages: string[]
  categoryIds: Record<string, number>
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('tasks')
  const [tasksData, setTasksData] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)

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

  // Search for mentions of this staff member
  useEffect(() => {
    if (activeTab !== 'mentions') return
    setSearchLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setSearchResults(d)
        setSearchLoading(false)
      })
      .catch(() => setSearchLoading(false))
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
                  <input type="checkbox" checked={task.done} disabled className="w-4 h-4" />
                  <span className="text-xs text-gray-600">{task.done ? 'Completed' : 'Pending'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function MentionsView() {
    return (
      <div>
        {searchLoading ? (
          <div className="text-center text-gray-400 py-4 text-sm">Searching...</div>
        ) : !searchResults ? (
          <div className="text-center text-gray-400 py-4 text-sm">No results</div>
        ) : (
          <div className="space-y-3">
            {searchResults.sales?.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2 text-sm">Sales</h3>
                {searchResults.sales.map((s: any) => (
                  <div key={s.id} className="text-sm text-gray-600 mb-1">
                    Receipt: {s.receipt_number} - {s.customer_name}
                  </div>
                ))}
              </div>
            )}
            {searchResults.bills?.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2 text-sm">Bills</h3>
                {searchResults.bills.map((b: any) => (
                  <div key={b.id} className="text-sm text-gray-600 mb-1">
                    Bill: {b.bill_number} - {b.vendor_name}
                  </div>
                ))}
              </div>
            )}
            {!searchResults.sales?.length && !searchResults.bills?.length && (
              <div className="text-center text-gray-400 text-sm">No mentions found</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-2 pt-2 space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
            className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        {activeTab === 'tasks' && <div className="p-3"><TasksView /></div>}
        {activeTab === 'mentions' && <div className="p-3"><MentionsView /></div>}
        {activeTab === 'dressCode' && (<>
          <DressCodeFlagsPanel filterStaff={staffName} />
          <div className="p-3 border-t border-gray-100">
            <ClosingReportLogView field="no_tshirt_staff" label="My Dress Code" icon="👕" filterStaff={staffName} />
          </div>
        </>)}
        {activeTab === 'training' && (
          <div className="p-3"><ContentPage contentKey="training_tutorial" title="📖 My Tutorial" submenu="My Tutorial" /></div>
        )}
        {activeTab === 'behaviour' && (
          <div className="p-3"><ManageLogPanel category="team_behaviour_log" label="My Behaviour Incidents" icon="🚦" filterAboutStaff={staffName} /></div>
        )}
        {activeTab === 'assessment' && (
          <div className="p-3"><AssessmentPanel staffName={staffName} /></div>
        )}
        {activeTab === 'meeting' && (
          <div className="p-3"><StaffMeetingPanel staffRoster={staffRoster} routablePages={routablePages} filterStaff={staffName} /></div>
        )}
        {activeTab === 'display' && (
          <div className="p-3"><ManageLogPanel category="staff_display" label="My Display" icon="📌" filterAboutStaff={staffName} /></div>
        )}
        {activeTab === 'laws' && (
          <div className="p-3"><ContentPage contentKey="training_laws" title="⚖️ My Company Laws Agreement" submenu="My Laws" /></div>
        )}
      </div>
    </div>
  )
}
