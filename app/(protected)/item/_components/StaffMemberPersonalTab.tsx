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
  const [tasksData, setTasksData] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const myTasksPanel = useLawsPanel(`show${staffName}MyTasksLaws`)
  const myMentionsPanel = useLawsPanel(`show${staffName}MyMentionsLaws`)
  const myDressCodeLaws = useLawsPanel(`show${staffName}MyDressCodeLaws`)
  const myTrainingLaws = useLawsPanel(`show${staffName}MyTrainingLaws`)
  const myBehaviourLaws = useLawsPanel(`show${staffName}MyBehaviourLaws`)
  const myAssessmentLaws = useLawsPanel(`show${staffName}MyAssessmentLaws`)
  const myMeetingLaws = useLawsPanel(`show${staffName}MyMeetingLaws`)
  const myDisplayLaws = useLawsPanel(`show${staffName}MyDisplayLaws`)
  const myLawsPanel = useLawsPanel(`show${staffName}MyLawsPanel`)

  // Fetch tasks assigned to this staff member
  useEffect(() => {
    if (!myTasksPanel.show) return
    setTasksLoading(true)
    fetch(`/api/tasks?assigned_to=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        setTasksData(Array.isArray(d) ? d : [])
        setTasksLoading(false)
      })
      .catch(() => setTasksLoading(false))
  }, [staffName, myTasksPanel.show])

  // Search for mentions of this staff member
  useEffect(() => {
    if (!myMentionsPanel.show) return
    setSearchLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setSearchResults(d)
        setSearchLoading(false)
      })
      .catch(() => setSearchLoading(false))
  }, [staffName, myMentionsPanel.show])

  function inlineLaws(scopeKey: string, panel: ReturnType<typeof useLawsPanel>) {
    return (<>
      <LawsToggleBar show={panel.show} setShow={panel.setShow}
        openForm={panel.openForm} setOpenForm={panel.setOpenForm}
        hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
        activeFilters={panel.activeFilters} toggleFilter={panel.toggleFilter} dark={false} />
      {panel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2">
          <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={() => {}}
            openForm={panel.openForm} setOpenForm={panel.setOpenForm}
            hideZeroFlags={panel.hideZeroFlags} setHideZeroFlags={panel.setHideZeroFlags}
            activeFilters={panel.activeFilters} />
        </div>
      )}
    </>)
  }

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
    <div className="px-2 space-y-2 pt-2">
      {/* My Tasks */}
      <div>
        <LawsToggleBar show={myTasksPanel.show} setShow={myTasksPanel.setShow}
          openForm={myTasksPanel.openForm} setOpenForm={myTasksPanel.setOpenForm}
          hideZeroFlags={myTasksPanel.hideZeroFlags} setHideZeroFlags={myTasksPanel.setHideZeroFlags}
          activeFilters={myTasksPanel.activeFilters} toggleFilter={myTasksPanel.toggleFilter}
          dark={false} />
        {myTasksPanel.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <TasksView />
          </div>
        )}
      </div>

      {/* Mentions */}
      <div>
        <LawsToggleBar show={myMentionsPanel.show} setShow={myMentionsPanel.setShow}
          openForm={myMentionsPanel.openForm} setOpenForm={myMentionsPanel.setOpenForm}
          hideZeroFlags={myMentionsPanel.hideZeroFlags} setHideZeroFlags={myMentionsPanel.setHideZeroFlags}
          activeFilters={myMentionsPanel.activeFilters} toggleFilter={myMentionsPanel.toggleFilter}
          dark={false} />
        {myMentionsPanel.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <MentionsView />
          </div>
        )}
      </div>

      {/* My Dress Code */}
      <div>
        {inlineLaws('My Dress Code', myDressCodeLaws)}
        {myDressCodeLaws.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <ClosingReportLogView field="no_tshirt_staff" label="My Dress Code" icon="👕" />
          </div>
        )}
      </div>

      {/* My Training */}
      <div>
        {inlineLaws('My Training', myTrainingLaws)}
        {myTrainingLaws.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <ContentPage contentKey="training_tutorial" title="📖 My Tutorial" submenu="My Tutorial" />
          </div>
        )}
      </div>

      {/* My Behaviour */}
      <div>
        {inlineLaws('My Behaviour', myBehaviourLaws)}
        {myBehaviourLaws.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <ManageLogPanel category="team_behaviour_log" label="My Behaviour Incidents" icon="🚦" />
          </div>
        )}
      </div>

      {/* My Assessment */}
      <div>
        {inlineLaws('My Assessment', myAssessmentLaws)}
        {myAssessmentLaws.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <AssessmentPanel />
          </div>
        )}
      </div>

      {/* My Meeting */}
      <div>
        {inlineLaws('My Meeting', myMeetingLaws)}
        {myMeetingLaws.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <StaffMeetingPanel staffRoster={staffRoster} routablePages={routablePages} />
          </div>
        )}
      </div>

      {/* My Display */}
      <div>
        {inlineLaws('My Display', myDisplayLaws)}
        {myDisplayLaws.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <ManageLogPanel category="staff_display" label="My Display" icon="📌" />
          </div>
        )}
      </div>

      {/* My Laws */}
      <div>
        {inlineLaws('My Laws', myLawsPanel)}
        {myLawsPanel.show && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 p-3">
            <ContentPage contentKey="training_laws" title="⚖️ My Company Laws Agreement" submenu="My Laws" />
          </div>
        )}
      </div>
    </div>
  )
}
