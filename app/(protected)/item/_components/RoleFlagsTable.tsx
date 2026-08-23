'use client'
import { Fragment, useMemo, useState } from 'react'
import { fmtOrdinalDate } from '@/lib/fmtDate'
import { SHORT_LABEL, ERRORS_TAB_VIOLATION, SUBMENU_HOME, type Violation } from './useViolations'
import ViolationFixPanel from './ViolationFixPanel'
import TaskViewPanel, { TASK_VIEWS } from './TaskViewPanel'

// Fallback display order for the group bars when no comprehensive
// allSubmenus list is supplied (Opener's own use of this table) --
// violations themselves are pre-sorted by count within a role's list, so
// grouping is done without disturbing that, just bucketed under whichever
// submenu bar comes first here.
const SUBMENU_ORDER = ['Items', 'Counts', 'Sales', 'CAB', 'Grony Manage']

// Which top-level tab each submenu bar actually lives under, same fallback
// case as above. A green section bar marks the boundary each time this
// changes walking down SUBMENU_ORDER.
const SECTION_OF: Record<string, string> = {
  Items: 'Grony Cash', Counts: 'Grony Cash', Sales: 'Grony Cash', CAB: 'Grony Cash',
  'Grony Manage': 'Grony Manage',
}

type Item = {
  id: number
  item_name: string
  cf_group: string | null
  selling_rate: string | null
  purchase_rate: string | null
  units_per_pack: string | null
  unit_name: string | null
  product_type: string
  calculated_soh: number
  gmc_type: string
}

export type CustomTask = {
  id: number
  title: string
  notes: string | null
  due_date: string | null
  submenu: string | null
  view: string | null
  done: boolean
  created_by: string | null
  created_at: string
}

type Period = { n: number; amt: number }
export type LossSummary = { total: Period; yesterday: Period; week: Period; month: Period; year: Period }
const cedis = (v: number) => `₵${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function addDaysStr(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueCell(v: Violation, deadline: string | undefined, threshold: number): { label: string; atRisk: boolean } {
  if (v.count === 0) return { label: '—', atRisk: false }
  let remaining: number
  let expiry: string
  if (deadline) {
    remaining = -daysSince(deadline)
    expiry = deadline
  } else if (v.type === 'daily') {
    remaining = 0
    expiry = addDaysStr(0)
  } else if (v.days !== null) {
    remaining = threshold - v.days
    expiry = addDaysStr(remaining)
  } else {
    return { label: '—', atRisk: false }
  }
  const atRisk = remaining < 0
  const days = remaining > 0 ? `${remaining}d left` : remaining === 0 ? 'due today' : `overdue ${Math.abs(remaining)}d`
  return { label: `${fmtOrdinalDate(expiry)} · ${days}`, atRisk }
}

// Editing an existing custom task uses the same fields as creating one --
// title, which submenu bar it lives under, which view (if any) its Fix
// button opens, notes, due date -- pre-filled from the task being edited.
// Kept as its own top-level component (not defined inline in the row map)
// so it isn't recreated every render.
function TaskEditForm({ task, submenuOptions, onSave, onCancel }: {
  task: CustomTask
  submenuOptions: string[]
  onSave: (patch: { title: string; notes: string | null; due_date: string | null; submenu: string; view: string | null }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [submenu, setSubmenu] = useState(task.submenu ?? submenuOptions[0] ?? '')
  const [view, setView] = useState(task.view ?? '')

  return (
    <div className="p-2 space-y-1.5 bg-gray-50">
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *"
        className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
      <select value={submenu} onChange={e => setSubmenu(e.target.value)}
        className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
        {submenuOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={view} onChange={e => setView(e.target.value)}
        className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
        {TASK_VIEWS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
      </select>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
        className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
      <div className="flex items-center gap-1.5">
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
        <button onClick={onCancel}
          className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
          Cancel
        </button>
        <button
          onClick={() => title.trim() && submenu && onSave({ title: title.trim(), notes: notes.trim() || null, due_date: dueDate || null, submenu, view: view || null })}
          disabled={!title.trim() || !submenu}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
          Save
        </button>
      </div>
    </div>
  )
}

// Flag data as a table instead of repeated "Name, X days left to fix..."
// sentences -- the panel title already says whose flags these are, so rows
// don't need to repeat it. One row per flag type: how many, when it's due,
// and (if explicitly assigned) who assigned it and when.
//
// Two click modes: pass `items`+`onItemsChanged` (Joe's panel) and a row
// click expands an inline accordion showing that violation's own fix view
// (reused from whichever tab already renders it) directly in place, with no
// navigation. Omit them (Bino/Opener) and a row click falls back to
// `onGoToViolation`, navigating to that violation's home tab as before.
export function RoleFlagsTable({ violations, assignments, deadlines, assignedBy, assignedOn, vSettings, onGoToViolation, items, onItemsChanged, lossSummary, onFixLossFeed, allSubmenus, onNavigateSubmenu, customTasks, onToggleTask, onDeleteTask, onUpdateTask }: {
  violations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation?: (key: string) => void
  items?: Item[]
  onItemsChanged?: (items: Item[]) => void
  lossSummary?: LossSummary
  onFixLossFeed?: () => void
  // Every real submenu (Tasks only) -- when supplied, every one of these
  // gets its own blue bar (0/✓ if nothing's flagged there), instead of only
  // ones that happen to have a violation type mapped to them.
  allSubmenus?: { label: string; section: string }[]
  onNavigateSubmenu?: (label: string) => void
  // User-created tasks (Tasks only), pinned to a submenu -- rendered as
  // extra rows under that submenu's bar, and counted into its total/badge
  // alongside the violation rows.
  customTasks?: CustomTask[]
  onToggleTask?: (task: CustomTask) => void
  onDeleteTask?: (id: number) => void
  onUpdateTask?: (id: number, patch: { title: string; notes: string | null; due_date: string | null; submenu: string; view: string | null }) => void
}) {
  const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
  const inlineFix = items !== undefined && onItemsChanged !== undefined
  const [expandedType, setExpandedType] = useState<string | null>(null)
  // Which custom task's own "Fix" button is expanded -- separate from
  // expandedType (violation types) since a task has no violation type of
  // its own, just whichever view it was pinned to when created.
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  // Which custom task is being edited -- mutually exclusive with the Fix
  // expansion above so a row never shows both open at once.
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  // Hidden by default so the table reads as a to-do list, not an audit log --
  // "Done" reveals the already-clear (✓) rows alongside the active ones.
  const [showDone, setShowDone] = useState(false)
  // "Bars only" collapses every group down to just its green/blue header
  // bars in one tap -- the baseline every group falls back to. Clicking a
  // bar (blue = one group, green = every group in that section) then
  // overrides just that bar's own groups, independent of the blanket
  // setting and of each other.
  // Defaults to collapsed -- with a bar for every submenu now (not just
  // ones with something flagged), starting fully expanded is far too tall
  // to fit one screen. Bars-only is one line each, so the panel opens
  // compact and each bar is still one tap away from its own detail.
  const [barsOnly, setBarsOnly] = useState(true)
  const [groupOverride, setGroupOverride] = useState<Map<string, boolean>>(new Map())

  function groupShown(submenu: string) {
    return groupOverride.has(submenu) ? groupOverride.get(submenu)! : !barsOnly
  }
  function toggleGroup(submenu: string) {
    setGroupOverride(prev => new Map(prev).set(submenu, !groupShown(submenu)))
  }
  function toggleSection(submenus: string[]) {
    const allShown = submenus.every(groupShown)
    setGroupOverride(prev => {
      const next = new Map(prev)
      for (const s of submenus) next.set(s, !allShown)
      return next
    })
  }

  // Bucket by the submenu each flag's fix view actually lives under (Items,
  // Counts, Sales, etc.) so a row's origin is obvious without opening it --
  // a bar per group instead of repeating the submenu name on every row.
  // The Loss Feed period totals (All-Time/Yesterday/etc.) are pinned into
  // the Counts group ahead of the Gains violation row instead of living in
  // their own separate table above this one -- Gains folded into Counts
  // once both routed to the same Live Sale tab.
  const lossRows = lossSummary ? [
    { label: 'All-Time', period: lossSummary.total },
    { label: 'Yesterday', period: lossSummary.yesterday },
    { label: 'This Week', period: lossSummary.week },
    { label: 'This Month', period: lossSummary.month },
    { label: 'This Year', period: lossSummary.year },
  ] : []
  const groupedViolations = useMemo(() => {
    const map = new Map<string, Violation[]>()
    for (const v of violations) {
      const violationKey = ERRORS_TAB_VIOLATION[v.type] ?? v.type
      const submenu = SUBMENU_HOME[violationKey] ?? 'Grony Manage'
      if (!map.has(submenu)) map.set(submenu, [])
      map.get(submenu)!.push(v)
    }
    if (lossSummary && !map.has('Counts')) map.set('Counts', [])

    const tasksBySubmenu = new Map<string, CustomTask[]>()
    for (const t of customTasks ?? []) {
      const key = t.submenu ?? 'Grony Manage'
      if (!tasksBySubmenu.has(key)) tasksBySubmenu.set(key, [])
      tasksBySubmenu.get(key)!.push(t)
    }

    // Comprehensive mode (Tasks): a bar for every real submenu, not just
    // ones with something flagged -- empty ones just show 0/✓ with no rows
    // and no expand/collapse (there's nothing to show), and clicking them
    // navigates there directly instead.
    if (allSubmenus) {
      const order = allSubmenus.map(s => s.label)
      const extra = Array.from(new Set([...map.keys(), ...tasksBySubmenu.keys()])).filter(k => !order.includes(k))
      const fullOrder = [...order, ...extra]
      const sectionOf = new Map(allSubmenus.map(s => [s.label, s.section]))
      return fullOrder.map((submenu, i) => {
        const rows = map.get(submenu) ?? []
        const tasks = tasksBySubmenu.get(submenu) ?? []
        const section = sectionOf.get(submenu) ?? 'Grony Manage'
        const prevSubmenu = fullOrder[i - 1]
        const prevSection = prevSubmenu !== undefined ? (sectionOf.get(prevSubmenu) ?? 'Grony Manage') : null
        const total = rows.reduce((s, v) => s + v.count, 0) + tasks.filter(t => !t.done).length
        return { submenu, rows, tasks, total, section, showSection: section !== prevSection }
      })
    }

    const order = SUBMENU_ORDER.filter(s => map.has(s))
    return order.map((submenu, i) => {
      const rows = map.get(submenu)!
      const section = SECTION_OF[submenu] ?? submenu
      const prevSubmenu = order[i - 1]
      const prevSection = prevSubmenu !== undefined ? (SECTION_OF[prevSubmenu] ?? prevSubmenu) : null
      return { submenu, rows, tasks: [] as CustomTask[], total: rows.reduce((s, v) => s + v.count, 0), section, showSection: section !== prevSection }
    })
  }, [violations, lossSummary, allSubmenus, customTasks])

  // Options for the submenu picker when editing a task -- every real
  // submenu bar in Tasks mode, else whatever's already grouped here.
  const submenuOptions = useMemo(() => (
    allSubmenus ? allSubmenus.map(s => s.label) : groupedViolations.map(g => g.submenu)
  ), [allSubmenus, groupedViolations])

  // Every submenu belonging to each section, so a green bar's click can
  // toggle all of its blue bars together.
  const submenusBySection = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const g of groupedViolations) {
      if (!m.has(g.section)) m.set(g.section, [])
      m.get(g.section)!.push(g.submenu)
    }
    return m
  }, [groupedViolations])

  // The column header row is only meaningful once at least one bar has
  // rows showing underneath it -- with every bar collapsed (the default),
  // it's just dead weight taking up space this panel needs to stay
  // scroll-free.
  const anyExpanded = groupedViolations.some(g => groupShown(g.submenu))

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-2.5 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
          Done
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={barsOnly}
            onChange={e => { setBarsOnly(e.target.checked); setGroupOverride(new Map()) }} />
          Bars only
        </label>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse table-fixed">
        {anyExpanded && (
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-2 py-1 font-semibold text-gray-500 whitespace-nowrap">Flag Type</th>
              <th className="text-center px-1.5 py-1 font-semibold text-gray-500 w-12">Count</th>
              <th className="text-left px-1.5 py-1 font-semibold text-gray-500 w-24">Due</th>
              <th className="text-left px-1.5 py-1 font-semibold text-gray-500 w-24">Assigned</th>
            </tr>
          </thead>
        )}
        {groupedViolations.map(({ submenu, rows, tasks, total, section, showSection }) => {
          const showRows = groupShown(submenu)
          // The Counts bar always has its loss period totals (lossRows) to
          // show regardless of whether there's an active Gains violation, so
          // it never counts as "empty" even when total (violation count) is 0.
          const hasContent = total > 0 || tasks.length > 0 || (submenu === 'Counts' && lossRows.length > 0)
          const pendingTasks = showDone ? tasks : tasks.filter(t => !t.done)
          // While collapsed, each pending task's own text still surfaces as a
          // subrow under the bar (col 2) instead of being hidden entirely
          // behind the count (now col 3) -- a submenu with several tasks gets
          // several subrows here. Expanding swaps these previews for the full
          // detail rows below instead of showing both.
          const [firstPreview, ...restPreview] = showRows ? [] : pendingTasks
          const onBarClick = () => (!hasContent && onNavigateSubmenu ? onNavigateSubmenu(submenu) : toggleGroup(submenu))
          return (
          <tbody key={submenu} className="divide-y divide-gray-100">
            {inlineFix && showSection && (
              <tr onClick={() => toggleSection(submenusBySection.get(section) ?? [submenu])} className="cursor-pointer">
                <td colSpan={4} className="px-3 py-1 bg-green-600 text-center">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wide">{section}</span>
                </td>
              </tr>
            )}
            <tr onClick={onBarClick} className="cursor-pointer">
              <td colSpan={2} className="px-3 py-1 bg-blue-600">
                <span className="font-bold text-white text-[11px]">
                  {!hasContent && onNavigateSubmenu ? '→ ' : showRows ? '▾ ' : '▸ '}{submenu}
                </span>
              </td>
              <td className="px-3 py-1 bg-blue-600 overflow-hidden">
                {firstPreview && (
                  <span className="block font-semibold text-white text-[11px] truncate" title={firstPreview.title}>{firstPreview.title}</span>
                )}
              </td>
              <td className="px-3 py-1 bg-blue-600 text-right">
                <span className="font-bold text-white text-[11px]">{total > 0 ? total : '✓'}</span>
              </td>
            </tr>
            {restPreview.map(t => (
              <tr key={`preview-${t.id}`} onClick={onBarClick} className="cursor-pointer">
                <td colSpan={2} className="px-3 py-1 bg-blue-600" />
                <td className="px-3 py-1 bg-blue-600 overflow-hidden">
                  <span className="block font-semibold text-white text-[11px] truncate" title={t.title}>{t.title}</span>
                </td>
                <td className="px-3 py-1 bg-blue-600" />
              </tr>
            ))}
            {showRows && pendingTasks.map(t => {
              const taskOpen = expandedTaskId === t.id
              const isEditing = editingTaskId === t.id
              return (
              <Fragment key={`task-${t.id}`}>
                <tr className="hover:bg-blue-50 transition">
                  <td className="px-2 py-1.5">
                    <span className={`block ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
                    {t.notes && <span className="block text-[9px] text-gray-400">{t.notes}</span>}
                    {t.created_by && <span className="block text-[9px] text-gray-400">by <span className="capitalize">{t.created_by}</span></span>}
                  </td>
                  <td className={`px-1.5 py-1.5 text-center font-bold ${t.done ? 'text-green-600' : 'text-gray-300'}`}>{t.done ? '✓' : '—'}</td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap text-gray-500">{t.due_date ? fmtOrdinalDate(t.due_date) : '—'}</td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {onUpdateTask && (
                        <button onClick={() => { setEditingTaskId(isEditing ? null : t.id); setExpandedTaskId(null) }}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap transition
                            ${isEditing ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          Edit
                        </button>
                      )}
                      {inlineFix && t.view && (
                        <button onClick={() => { setExpandedTaskId(taskOpen ? null : t.id); setEditingTaskId(null) }}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap transition
                            ${taskOpen ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          Fix
                        </button>
                      )}
                      <button onClick={() => onToggleTask?.(t)}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap transition
                          ${t.done ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {t.done ? '✓ Completed' : 'Completed'}
                      </button>
                      <button onClick={() => onDeleteTask?.(t.id)} title="Delete task" className="shrink-0 text-gray-300 hover:text-red-500">×</button>
                    </div>
                  </td>
                </tr>
                {isEditing && (
                  <tr>
                    <td colSpan={4} className="p-0 border-t border-gray-200">
                      <TaskEditForm task={t} submenuOptions={submenuOptions}
                        onCancel={() => setEditingTaskId(null)}
                        onSave={patch => { onUpdateTask?.(t.id, patch); setEditingTaskId(null) }} />
                    </td>
                  </tr>
                )}
                {inlineFix && taskOpen && t.view && (
                  <tr>
                    <td colSpan={4} className="p-0 border-t border-gray-200 bg-white">
                      <div className="max-h-[60vh] overflow-auto">
                        <TaskViewPanel view={t.view} items={items!} onItemsChanged={onItemsChanged!} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
              )
            })}
            {showRows && submenu === 'Counts' && lossRows.map(r => (
              <tr key={r.label} onClick={() => r.period.n > 0 && onFixLossFeed?.()}
                className={`transition ${r.period.n > 0 ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
                <td className={`px-2 py-1.5 whitespace-nowrap ${r.period.n > 0 ? 'text-gray-800' : 'text-gray-400'}`}>{r.label}</td>
                <td className={`px-1.5 py-1.5 text-center font-bold ${r.period.n > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {r.period.n > 0 ? r.period.n : '✓'}
                </td>
                <td className={`px-1.5 py-1.5 whitespace-nowrap ${r.period.n > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  {r.period.n > 0 ? cedis(r.period.amt) : '—'}
                </td>
                <td className="px-1.5 py-1.5 text-gray-500 whitespace-nowrap">—</td>
              </tr>
            ))}
            {showRows && (showDone ? rows : rows.filter(v => v.count > 0)).map(v => {
              const { label: dueLabel, atRisk } = dueCell(v, deadlines[v.type], threshold)
              const explicitlyAssigned = !!assignments[v.type]
              const violationKey = ERRORS_TAB_VIOLATION[v.type] ?? v.type
              const isOpen = expandedType === v.type

              return (
                <Fragment key={v.type}>
                  <tr
                    onClick={() => inlineFix ? setExpandedType(isOpen ? null : v.type) : onGoToViolation?.(violationKey)}
                    className={`cursor-pointer hover:bg-blue-50 transition ${atRisk ? 'bg-red-50' : ''} ${isOpen ? 'bg-blue-50' : ''}`}>
                    <td className={`px-2 py-1.5 whitespace-nowrap ${v.count > 0 ? 'text-gray-800' : 'text-gray-400'}`}>{SHORT_LABEL[v.type] ?? v.label}</td>
                    <td className={`px-1.5 py-1.5 text-center font-bold ${v.count > 0 ? (atRisk ? 'text-red-600' : 'text-gray-900') : 'text-green-600'}`}>
                      {v.count > 0 ? v.count : '✓'}
                    </td>
                    <td className={`px-1.5 py-1.5 whitespace-nowrap ${atRisk ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{dueLabel}</td>
                    <td className="px-1.5 py-1.5 text-gray-500 whitespace-nowrap">
                      {explicitlyAssigned && assignedOn[v.type] ? (
                        <>{fmtOrdinalDate(assignedOn[v.type])}{assignedBy[v.type] && <> by <span className="capitalize">{assignedBy[v.type]}</span></>}</>
                      ) : '—'}
                    </td>
                  </tr>
                  {inlineFix && isOpen && (
                    <tr>
                      <td colSpan={4} className="p-0 border-t border-gray-200 bg-white">
                        <div className="max-h-[60vh] overflow-auto">
                          <ViolationFixPanel type={v.type} items={items!} onItemsChanged={onItemsChanged!} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          )
        })}
      </table>
      </div>
    </div>
  )
}
