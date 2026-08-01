'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { RoleFlagsTable, type CustomTask, type LossSummary } from './RoleFlagsTable'
import type { Violation } from './useViolations'
import { ASSIGNABLE_VIOLATIONS } from './violationAssignments'

// A personalized "what's mine" summary, separate from the full shared
// violations table below (which shows everything to everyone) -- only
// renders once there's something assigned to whoever's actually looking.
function MyAssignmentsSummary({ assignments, deadlines }: { assignments: Record<string, string>; deadlines: Record<string, string> }) {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const mine = username ? ASSIGNABLE_VIOLATIONS.filter(v => (assignments[v.type] ?? '').toLowerCase() === username) : []
  if (mine.length === 0) return null
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide px-3 pt-2.5 pb-1">Assigned to You</p>
      <div className="divide-y divide-blue-100">
        {mine.map(v => (
          <div key={v.type} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
            <span className="text-gray-700 truncate">{v.label}</span>
            {deadlines[v.type] && <span className="text-gray-500 shrink-0">due {deadlines[v.type]}</span>}
          </div>
        ))}
      </div>
    </div>
  )
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
}

type SubmenuEntry = { label: string; section: string; action: () => void }

// One top-level tab's own Tasks -- everything RolePanel's old unified "Joe"
// panel did, just scoped to whichever submenus/violations belong to the tab
// this is mounted under (see item/page.tsx's cashTasksViolations/
// manageTasksViolations split and GronyManageTab's own instance). Each
// instance fetches and filters its own customTasks rather than sharing one
// fetch, since Cash's and Manage's Tasks are never both on screen together.
export default function TasksView({
  violations, allSubmenus, assignments, deadlines, assignedBy, assignedOn, vSettings,
  isOwnTask, items, onItemsChanged, showLossSummary, onFixLossFeed, onGoToViolation,
}: {
  violations: Violation[]
  allSubmenus: SubmenuEntry[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  // Which customTasks belong here -- Cash keeps ones tagged to a Cash
  // submenu, Manage keeps everything else (the "former Bino" advert/jingle/
  // equipment/staff-times bucket has no single real submenu name of its
  // own, so it's whatever isn't explicitly Cash's).
  isOwnTask: (submenu: string) => boolean
  // Only Cash's Tasks passes these -- lets violation rows expand inline
  // (reusing ItemsTab/SalesTab/CountsTab/etc, same as the old unified
  // panel), instead of just navigating away. Manage's Tasks has no inline
  // fix views of its own (see ViolationFixPanel's fallback), so it omits
  // these and uses onGoToViolation to navigate for real instead.
  items?: Item[]
  onItemsChanged?: (items: Item[]) => void
  showLossSummary?: boolean
  onFixLossFeed?: () => void
  onGoToViolation?: (key: string) => void
}) {
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([])
  function loadCustomTasks() {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(d => {
      setCustomTasks(Array.isArray(d) ? d.filter((t: CustomTask) => isOwnTask(t.submenu ?? '')) : [])
    }).catch(() => {})
  }
  useEffect(() => { loadCustomTasks() }, [])

  async function toggleTask(task: CustomTask) {
    setCustomTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    }).catch(() => {})
    loadCustomTasks()
  }
  async function deleteTask(id: number) {
    setCustomTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }
  async function updateTask(id: number, patch: { title: string; notes: string | null; due_date: string | null; submenu: string; view: string | null }) {
    setCustomTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
    loadCustomTasks()
  }

  // Loss-feed summaries -- all-time, yesterday, this week (Mon-start), this
  // month, this year. Cash's Tasks only (Loss by Date is a Cash submenu).
  const [lossEvents, setLossEvents] = useState<{ date: string; loss_amt: number }[] | null>(null)
  useEffect(() => {
    if (!showLossSummary) return
    fetch('/api/losses/events')
      .then(r => r.ok ? r.json() : [])
      .then(d => setLossEvents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [showLossSummary])

  const lossSummary = useMemo<LossSummary | null>(() => {
    if (!lossEvents) return null
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const y = new Date(today0); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today0); weekStart.setDate(weekStart.getDate() - ((today0.getDay() + 6) % 7))
    const monthStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today0.getFullYear()}-01-01`
    const yesterday = fmtLocal(y), ws = fmtLocal(weekStart)
    const agg = (pred: (d: string) => boolean) => {
      const list = lossEvents.filter(e => pred(e.date))
      return { n: list.length, amt: parseFloat(list.reduce((s, e) => s + (Number(e.loss_amt) || 0), 0).toFixed(2)) }
    }
    return {
      total: agg(() => true),
      yesterday: agg(d => d === yesterday),
      week: agg(d => d >= ws),
      month: agg(d => d >= monthStart),
      year: agg(d => d >= yearStart),
    }
  }, [lossEvents])

  return (
    <div className="px-4 py-2 space-y-2">
      <MyAssignmentsSummary assignments={assignments} deadlines={deadlines} />
      <RoleFlagsTable violations={violations} assignments={assignments} deadlines={deadlines}
        assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
        items={items} onItemsChanged={onItemsChanged} onGoToViolation={onGoToViolation}
        lossSummary={lossSummary ?? undefined} onFixLossFeed={onFixLossFeed}
        allSubmenus={allSubmenus}
        onNavigateSubmenu={label => allSubmenus.find(s => s.label === label)?.action()}
        customTasks={customTasks} onToggleTask={toggleTask} onDeleteTask={deleteTask} onUpdateTask={updateTask} />
    </div>
  )
}
