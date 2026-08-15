'use client'
import { useState, useEffect } from 'react'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
import ManageLogPanel from './ManageLogPanel'
import ContentPage from './ContentPage'
import DressCodeFlagsPanel from './DressCodeFlagsPanel'
import ClosingReportLogView from './ClosingReportLogView'
import AssessmentPanel from './AssessmentPanel'
import StaffMeetingPanel from './StaffMeetingPanel'

type PersonalStaffTab = 'myTasks' | 'mentions' | 'myDressCode' | 'myTraining' | 'myMeeting' | 'myBehaviour' | 'myAssessment' | 'myLaws' | 'myDisplay'

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
  const [tab, setTab] = useState<PersonalStaffTab>('myTasks')
  const [tasksData, setTasksData] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const myDressCodeLaws = useLawsPanel('showMyDressCodeLaws')
  const myTrainingLaws = useLawsPanel('showMyTrainingLaws')
  const myBehaviourLaws = useLawsPanel('showMyBehaviourLaws')
  const myAssessmentLaws = useLawsPanel('showMyAssessmentLaws')
  const myMeetingLaws = useLawsPanel('showMyMeetingLaws')
  const myLawsPanel = useLawsPanel('showMyLaws')

  // Fetch tasks assigned to this staff member
  useEffect(() => {
    setTasksLoading(true)
    fetch(`/api/tasks?assigned_to=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        setTasksData(Array.isArray(d) ? d : [])
        setTasksLoading(false)
      })
      .catch(() => setTasksLoading(false))
  }, [staffName])

  // Search for mentions of this staff member
  useEffect(() => {
    if (tab !== 'mentions') return
    setSearchLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setSearchResults(d)
        setSearchLoading(false)
      })
      .catch(() => setSearchLoading(false))
  }, [tab, staffName])

  const tabs: { key: PersonalStaffTab; label: string }[] = [
    { key: 'myTasks', label: 'My Tasks' },
    { key: 'mentions', label: 'Mentions' },
    { key: 'myDressCode', label: 'My Dress Code' },
    { key: 'myTraining', label: 'My Training' },
    { key: 'myMeeting', label: 'My Meeting' },
    { key: 'myBehaviour', label: 'My Behaviour' },
    { key: 'myAssessment', label: 'My Assessment' },
    { key: 'myDisplay', label: 'My Display' },
    { key: 'myLaws', label: 'My Laws' },
  ]

  function inlineLaws(scopeKey: string, panel: ReturnType<typeof useLawsPanel>) {
    return (<>
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={panel.show} setShow={panel.setShow}
          openForm={panel.openForm} setOpenForm={panel.setOpenForm}
          hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
          activeFilters={panel.activeFilters} toggleFilter={panel.toggleFilter} dark={false} />
      </div>
      {panel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={() => {}}
            openForm={panel.openForm} setOpenForm={panel.setOpenForm}
            hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
            activeFilters={panel.activeFilters} />
        </div>
      )}
    </>)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-gray-200 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t.key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'myTasks' && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Tasks Assigned to {staffName}</h2>
            {tasksLoading ? (
              <div className="text-center text-gray-400 py-8">Loading tasks...</div>
            ) : tasksData.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No tasks assigned</div>
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
        )}

        {tab === 'mentions' && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Mentions of {staffName}</h2>
            {searchLoading ? (
              <div className="text-center text-gray-400 py-8">Searching...</div>
            ) : !searchResults ? (
              <div className="text-center text-gray-400 py-8">No results</div>
            ) : (
              <div className="space-y-3">
                {searchResults.sales?.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Sales</h3>
                    {searchResults.sales.map((s: any) => (
                      <div key={s.id} className="text-sm text-gray-600 mb-1">
                        Receipt: {s.receipt_number} - {s.customer_name}
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.bills?.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Bills</h3>
                    {searchResults.bills.map((b: any) => (
                      <div key={b.id} className="text-sm text-gray-600 mb-1">
                        Bill: {b.bill_number} - {b.vendor_name}
                      </div>
                    ))}
                  </div>
                )}
                {!searchResults.sales?.length && !searchResults.bills?.length && (
                  <div className="text-center text-gray-400">No mentions found</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'myDressCode' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Dress Code</h2>
            {inlineLaws('My Dress Code', myDressCodeLaws)}
            <ClosingReportLogView field="no_tshirt_staff" label="My Dress Code" icon="👕" />
          </div>
        )}

        {tab === 'myTraining' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Training</h2>
            {inlineLaws('My Training', myTrainingLaws)}
            <ContentPage contentKey="training_tutorial" title="📖 My Tutorial" submenu="My Tutorial" />
          </div>
        )}

        {tab === 'myMeeting' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Meeting</h2>
            {inlineLaws('My Meeting', myMeetingLaws)}
            <StaffMeetingPanel staffRoster={staffRoster} routablePages={routablePages} />
          </div>
        )}

        {tab === 'myBehaviour' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Behaviour</h2>
            {inlineLaws('My Behaviour', myBehaviourLaws)}
            <ManageLogPanel category="team_behaviour_log" label="My Behaviour Incidents" icon="🚦" />
          </div>
        )}

        {tab === 'myAssessment' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Assessment</h2>
            {inlineLaws('My Assessment', myAssessmentLaws)}
            <AssessmentPanel />
          </div>
        )}

        {tab === 'myDisplay' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Display</h2>
            <ManageLogPanel category="staff_display" label="My Display" icon="📌" />
          </div>
        )}

        {tab === 'myLaws' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">My Company Laws Agreement</h2>
            {inlineLaws('My Laws', myLawsPanel)}
            <ContentPage contentKey="training_laws" title="⚖️ My Company Laws Agreement" submenu="My Laws" />
          </div>
        )}
      </div>
    </div>
  )
}
