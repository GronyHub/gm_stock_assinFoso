'use client'
import { useState, useEffect, useCallback } from 'react'
import DynamicTasksSection from './DynamicTasksSection'
import PageLawsNote from './PageLawsNote'

type PanelKind = 'law' | 'flags' | 'notes' | 'tasks'

const TITLES: Record<PanelKind, string> = { law: '⚖️ Law', flags: '🚩 Flags', notes: '📝 Notes', tasks: '✅ Tasks' }

// Four icons every real page carries: Law (the fixed rule for this page,
// rarely edited), Flags (existing violation/overdue counts -- real
// business logic computed by whoever renders this page, passed in as
// `flagsCount` rather than invented here), Notes (a day-to-day scratchpad,
// split out from Law even though both are freeform text -- see
// PageLawsNote), and Tasks (the checklist this used to be paired with
// alone). Each icon badges its own count the same way the pane's own
// SidePaneButton does. Law/Notes/Tasks counts are fetched here directly
// (same scope_key/submenu namespace as page_notes/custom_tasks) since
// every page gets this bar and none of them otherwise know these numbers;
// Flags is the one exception, since it's page-specific business logic that
// already exists elsewhere and shouldn't be recomputed twice.
export default function PageToolIcons({ scopeKey, flagsCount }: { scopeKey: string; flagsCount?: number }) {
  const [open, setOpen] = useState<PanelKind | null>(null)
  const [taskCount, setTaskCount] = useState(0)
  const [hasLaw, setHasLaw] = useState(false)
  const [hasNotes, setHasNotes] = useState(false)

  const loadCounts = useCallback(() => {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then((all: unknown) => {
      const list = Array.isArray(all) ? all as { submenu?: string; done?: boolean }[] : []
      setTaskCount(list.filter(t => t.submenu === scopeKey && !t.done).length)
    }).catch(() => {})
    fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&kind=law`).then(r => r.ok ? r.json() : null)
      .then(d => setHasLaw(!!d?.notes?.trim())).catch(() => {})
    fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&kind=note`).then(r => r.ok ? r.json() : null)
      .then(d => setHasNotes(!!d?.notes?.trim())).catch(() => {})
  }, [scopeKey])

  useEffect(() => { loadCounts() }, [loadCounts])

  function close() {
    setOpen(null)
    loadCounts()
  }

  const icons: { kind: PanelKind; icon: string; count?: number }[] = [
    { kind: 'law', icon: '⚖️', count: hasLaw ? 1 : 0 },
    { kind: 'flags', icon: '🚩', count: flagsCount },
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
              {open === 'law' && <PageLawsNote scopeKey={scopeKey} kind="law" />}
              {open === 'notes' && <PageLawsNote scopeKey={scopeKey} kind="note" />}
              {open === 'flags' && (
                <div className="py-6 text-center text-sm text-gray-500 px-3">
                  {flagsCount && flagsCount > 0
                    ? <p>🚩 {flagsCount} flag{flagsCount === 1 ? '' : 's'} currently open on this page -- see the flagged rows on the page itself.</p>
                    : <p>No flags right now.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
