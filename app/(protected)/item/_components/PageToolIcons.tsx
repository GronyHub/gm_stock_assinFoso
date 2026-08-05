'use client'
import { useState, useEffect, useCallback } from 'react'
import DynamicTasksSection from './DynamicTasksSection'
import PageLawsNote from './PageLawsNote'
import PageLawsList from './PageLawsList'

type PanelKind = 'law' | 'notes' | 'tasks'

const TITLES: Record<PanelKind, string> = { law: '⚖️ Law', notes: '📝 Notes', tasks: '✅ Tasks' }

// Three icons every real page carries: Law (a real list of this page's own
// fixed rules -- see PageLawsList/page_laws -- badged with how many laws
// it has, not just whether one exists), Notes (a day-to-day scratchpad,
// still one freeform textarea -- see PageLawsNote), and Tasks (the
// checklist this used to be paired with alone). Each badges its own count
// the same way the pane's own SidePaneButton does, fetched here directly
// (same scope_key/submenu namespace as page_laws/page_notes/custom_tasks)
// since every page gets this bar and none of them otherwise know these
// numbers.
//
// There used to be a fourth, generic Flags icon here too -- removed. Every
// real flag/violation type already has its own dedicated button elsewhere
// (Items/Sales/Bills' per-category flag letters, ManageLogPanel's
// jingle/equipment overdue banner, DressCodeFlagsPanel, etc.) that jumps
// straight to that specific violation list. This bar's Flags icon never
// did that -- it had no count of its own and just opened a static message
// pointing back at those real ones, so it was a placeholder, not a flag.
export default function PageToolIcons({ scopeKey }: { scopeKey: string }) {
  const [open, setOpen] = useState<PanelKind | null>(null)
  const [taskCount, setTaskCount] = useState(0)
  const [lawCount, setLawCount] = useState(0)
  const [hasNotes, setHasNotes] = useState(false)

  const loadCounts = useCallback(() => {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then((all: unknown) => {
      const list = Array.isArray(all) ? all as { submenu?: string; done?: boolean }[] : []
      setTaskCount(list.filter(t => t.submenu === scopeKey && !t.done).length)
    }).catch(() => {})
    fetch(`/api/page-laws?scopeKey=${encodeURIComponent(scopeKey)}`).then(r => r.ok ? r.json() : [])
      .then(d => setLawCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
    fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&kind=note`).then(r => r.ok ? r.json() : null)
      .then(d => setHasNotes(!!d?.notes?.trim())).catch(() => {})
  }, [scopeKey])

  useEffect(() => { loadCounts() }, [loadCounts])

  function close() {
    setOpen(null)
    loadCounts()
  }

  const icons: { kind: PanelKind; icon: string; count?: number }[] = [
    { kind: 'law', icon: '⚖️', count: lawCount },
    { kind: 'notes', icon: '📝', count: hasNotes ? 1 : 0 },
    { kind: 'tasks', icon: '✅', count: taskCount },
  ]

  return (
    <div className="flex items-center gap-1.5">
      {icons.map(({ kind, icon, count }) => (
        <button key={kind} onClick={() => setOpen(kind)} title={TITLES[kind]}
          className="relative text-sm leading-none px-1.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
          {icon}
          {!!count && count > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold leading-none rounded-full bg-red-600 text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      ))}
      {open && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={close}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
              <p className="text-sm font-bold text-gray-900">{TITLES[open]}</p>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
            </div>
            <div className="p-2">
              {open === 'tasks' && <DynamicTasksSection scopeKey={scopeKey} />}
              {open === 'law' && <PageLawsList scopeKey={scopeKey} onChange={loadCounts} />}
              {open === 'notes' && <PageLawsNote scopeKey={scopeKey} kind="note" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
