'use client'
import { useState } from 'react'
import { TabErrorBoundary, GronyManageContent, StaffContent, STAFF_ROSTER } from './hubShared'
import ManageLogPanel from '../_components/ManageLogPanel'
import type { ManageView } from '../_components/manageViewData'
import type { StaffView } from '../_components/staffViewData'
import type { HubCtx } from './useHubState'

type Item =
  | { kind: 'form'; key: string; icon: string; label: string; need: 'all' | 'team' | 'manage'; render: (h: HubCtx) => React.ReactNode }
  | { kind: 'go'; key: string; icon: string; label: string; need: 'all' | 'cash' | 'owner'; run: (h: HubCtx) => void }

// "Record something": one place to record anything that is logged in the app. A tile either opens its form right here, or takes you to the page where it is recorded.
export default function HubRecord({ h, embedded = false }: { h: HubCtx; embedded?: boolean }) {
  const [pick, setPick] = useState('')
  const x = h as unknown as Record<string, any>
  const manage = (key: string, sub?: { advertSub?: ManageView; checksSub?: ManageView }) => (
    <GronyManageContent key={key} view={(sub?.advertSub ? 'advert' : sub?.checksSub ? 'grony_checks' : key) as ManageView} {...sub}
      canManage={x.canManage} categoryIds={x.fixedCategoryIds} openerViolations={x.openerViolations} assignments={x.assignments} deadlines={x.deadlines}
      assignedBy={x.assignedBy} assignedOn={x.assignedOn} vSettings={x.vSettings} onGoToViolation={x.goToViolation}
      missingClosingReportsCount={x.globalFlags?.missingClosingReports?.length ?? 0} onOpenStaff={() => h.openShop('times')} propertiesInitialTab={x.propertiesInitialTab} />
  )
  const staff = (view: StaffView) => (
    <StaffContent key={view} view={view} viewingName={x.viewingName} role={h.role} username={h.username} canSeeTeam={x.canSeeTeam} canSeeUsers={x.canSeeUsers}
      canSeeRoles={x.canManage} canManage={x.canManage} staffRoster={STAFF_ROSTER} routablePages={x.routablePages} categoryIds={x.fixedCategoryIds} openAddSignal={x.staffTimeSignal} />
  )
  const leave = (fn: () => void) => { h.setShop(null); fn() }
  const reportAbsence = () => {
    h.setShop(null); h.openPersonal(h.username, 'times')
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-absence-report', { detail: { handled: false } })), 700)
  }

  const groups: { title: string; items: Item[] }[] = [
    { title: 'About people', items: [
      { kind: 'go', key: 'absent', icon: '🙋', label: 'Late or absent', need: 'all', run: () => reportAbsence() },
      { kind: 'form', key: 'behaviour', icon: '🚦', label: 'Staff behaviour', need: 'team', render: () => <ManageLogPanel category="team_behaviour_log" label="Behaviour Incidents" icon="🚦" aboutStaffRoster={STAFF_ROSTER} /> },
      { kind: 'form', key: 'dress', icon: '👕', label: 'Dress code', need: 'team', render: () => staff('staff_dress') },
      { kind: 'form', key: 'display', icon: '📌', label: 'Team display', need: 'team', render: () => staff('staff_display') },
      { kind: 'form', key: 'meeting', icon: '🗣️', label: 'Team meeting', need: 'team', render: () => staff('staff_meeting') },
    ] },
    { title: 'About the shop', items: [
      { kind: 'form', key: 'unfortunate_events', icon: '🚨', label: 'Unfortunate event', need: 'manage', render: () => manage('unfortunate_events') },
      { kind: 'form', key: 'arrangement', icon: '🪑', label: 'Arrangement', need: 'manage', render: () => manage('grony_checks', { checksSub: 'arrangement' as ManageView }) },
      { kind: 'form', key: 'cleanliness', icon: '🧹', label: 'Cleanliness', need: 'manage', render: () => manage('grony_checks', { checksSub: 'cleanliness' as ManageView }) },
      { kind: 'form', key: 'customer_display', icon: '🖼️', label: 'Customer display', need: 'manage', render: () => manage('grony_checks', { checksSub: 'customer_display' as ManageView }) },
      { kind: 'form', key: 'repair_works', icon: '🔧', label: 'Repair works', need: 'manage', render: () => manage('grony_checks', { checksSub: 'repair_works' as ManageView }) },
      { kind: 'form', key: 'security_chk', icon: '🔒', label: 'Security check', need: 'manage', render: () => manage('grony_checks', { checksSub: 'security_chk' as ManageView }) },
      { kind: 'form', key: 'quality_assurance', icon: '✅', label: 'Quality assurance', need: 'manage', render: () => manage('quality_assurance') },
      { kind: 'form', key: 'future', icon: '🔭', label: 'Future', need: 'manage', render: () => manage('future') },
      { kind: 'form', key: 'jingle', icon: '🎵', label: 'Jingle log', need: 'manage', render: () => manage('advert', { advertSub: 'jingle' as ManageView }) },
      { kind: 'form', key: 'equipment', icon: '🔊', label: 'Equipment check', need: 'manage', render: () => manage('advert', { advertSub: 'equipment' as ManageView }) },
      { kind: 'form', key: 'app_info', icon: 'ℹ️', label: 'App info', need: 'manage', render: () => manage('app_info') },
    ] },
    { title: 'Sales, stock and money', items: [
      { kind: 'go', key: 'job', icon: '🧾', label: 'Pending job', need: 'all', run: () => leave(() => h.openEmbed('/pending-jobs?new=1')) },
      { kind: 'go', key: 'past', icon: '🕐', label: 'Sale for a past day', need: 'cash', run: () => leave(() => { h.goItemsMode('sale'); h.setMiDate(new Date(Date.now() - 86400000).toISOString().slice(0, 10)); h.setMiOn(true) }) },
      { kind: 'go', key: 'logentry', icon: '📈', label: 'New log entry', need: 'cash', run: () => leave(() => { h.goItemsMode('log'); h.setLiveNewEntryOpen(true) }) },
      { kind: 'go', key: 'count', icon: '🔢', label: 'Stock count', need: 'cash', run: () => leave(() => h.pickLossView('counts')) },
      { kind: 'go', key: 'expense', icon: '💸', label: 'Expense', need: 'owner', run: () => leave(() => h.goItemsMode('expenses')) },
      { kind: 'go', key: 'bill', icon: '📥', label: 'Bill', need: 'owner', run: () => leave(() => h.goItemsMode('bills')) },
    ] },
  ]
  const allowed = (need: string) => need === 'all' || (need === 'team' && !!x.canSeeTeam) || (need === 'manage' && !!x.canSeeManage) || (need === 'cash' && !!h.canSeeCash) || (need === 'owner' && !!h.isOwnerOrJoe && !!h.canSeeCash)
  const chosen = groups.flatMap(g => g.items).find(i => i.kind === 'form' && i.key === pick) as Extract<Item, { kind: 'form' }> | undefined

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-4 px-3 pb-28 pt-3'}>
      {!embedded && (
      <div>
        <h1 className="text-xl text-gray-900">Record something</h1>
        <p className="text-[13px] text-gray-500">Pick what you want to record. A form opens below, or you are taken to the page where it is recorded.</p>
      </div>)}
      {groups.map(g => {
        const items = g.items.filter(i => allowed(i.need))
        if (!items.length) return null
        return (
          <section key={g.title} aria-label={g.title} className="space-y-1.5">
            <h2 className="text-[13px] text-gray-500">{g.title}</h2>
            <div className="grid grid-cols-3 gap-2">
              {items.map(i => (
                <button key={i.key} type="button" aria-pressed={i.kind === 'form' ? pick === i.key : undefined}
                  onClick={() => (i.kind === 'form' ? setPick(p => (p === i.key ? '' : i.key)) : i.run(h))}
                  className={`flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left active:opacity-80 ${i.kind === 'form' && pick === i.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                  <span aria-hidden="true" className="text-lg leading-none">{i.icon}</span>
                  <span className="line-clamp-2 w-full text-[12px] leading-tight text-gray-700">{i.label}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
      {chosen && (
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          <p className="mb-1 px-1 text-[14px] font-medium text-gray-900">{chosen.icon} {chosen.label}</p>
          <TabErrorBoundary>{chosen.render(h)}</TabErrorBoundary>
        </div>
      )}
    </div>
  )
}
