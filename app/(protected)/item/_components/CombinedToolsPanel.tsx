'use client'
import { useEffect, useRef } from 'react'
import { useToolsPanel, type ToolsPanelKind, type ToolsPanelFlag } from './ToolsPanelContext'
import DynamicTasksSection from './DynamicTasksSection'
import PageLawsNote from './PageLawsNote'
import PageLawsList from './PageLawsList'

const SECTIONS: { kind: ToolsPanelKind; icon: string; label: string; accent: string }[] = [
  { kind: 'law', icon: '⚖️', label: 'Law', accent: 'bg-indigo-50 border-indigo-100' },
  { kind: 'tasks', icon: '✅', label: 'Tasks', accent: 'bg-green-50 border-green-100' },
  { kind: 'notes', icon: '📝', label: 'Notes', accent: 'bg-amber-50 border-amber-100' },
]

// Mounted once, directly inside item/page.tsx's own content-area wrapper
// (the same `relative flex-1 min-w-0 min-h-0 flex flex-col` div every page's
// content already renders into) -- `absolute inset-0` here fills exactly
// that space, leaving the left pane (a flex sibling, outside this wrapper
// entirely) untouched and still fully usable. See ToolsPanelContext.tsx for
// why this needs to live here instead of inside PageToolIcons itself.
//
// Law, Tasks, Notes, and now this page's own Flags all show at once,
// stacked in that order, in one scroll -- there used to be a tab switcher
// here that hid sections behind a click; that's gone per direct feedback
// ("I don't want to be clicking several buttons for information"). Flags
// were the last thing still living outside this window (each page's own
// separate pill row) -- direct feedback: "put the flags also in the law
// window... so everything be in same window". Each Law/Tasks/Notes section
// is still exactly the same add/edit-capable component as before
// (PageLawsList/DynamicTasksSection/PageLawsNote, unchanged internally).
// Flags are read-only summaries here (label, count, and the page's own
// description text where it has one) with a "View flagged records" button
// that hands off to whatever that specific page does to show them
// (goToViolation for Items/Sales/Bills, a local activeFlag setter for
// Expenses, ...) -- see panel.onFlagClick, supplied by whichever
// PageToolIcons instance opened this. Showing the live flagged rows
// themselves inline isn't done here -- each page's own filtered table is
// its own, often large, already-built component; this links to it rather
// than re-implementing every page's table a second time inside one
// generic window.
export default function CombinedToolsPanel() {
  const ctx = useToolsPanel()
  const panel = ctx?.panel

  const lawRef = useRef<HTMLDivElement>(null)
  const tasksRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)
  const refByKind: Record<ToolsPanelKind, React.RefObject<HTMLDivElement | null>> = {
    law: lawRef, tasks: tasksRef, notes: notesRef,
  }

  useEffect(() => {
    if (!panel) return
    refByKind[panel.kind].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel])

  if (!panel) return null
  const flags = panel.flags ?? []

  function viewFlag(flag: ToolsPanelFlag) {
    panel!.onFlagClick?.(flag.key)
    ctx!.closePanel()
  }

  const addLaw = () => {
    // TODO: Focus add law input in PageLawsList
  }

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900 truncate">{panel.scopeKey === 'Items' ? 'Items Laws' : panel.scopeKey}</p>
        <div className="flex items-center gap-1 shrink-0">
          {panel.scopeKey === 'Items' && (
            <button onClick={addLaw} title="Add law"
              className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none px-1">+</button>
          )}
          <button onClick={ctx.closePanel} title="Close"
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-1">×</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {panel.scopeKey === 'Items' ? (
          <div ref={lawRef} className="bg-white">
            <PageLawsList
              scopeKey={panel.scopeKey}
              flags={flags.map(f => ({
                key: f.key,
                label: f.label,
                description: f.description,
                count: f.count,
                onViewClick: () => viewFlag(f),
              }))}
              isItemsLaws={true}
            />
          </div>
        ) : (
          <div className="p-2.5 space-y-3">
            {SECTIONS.map(s => (
              <div key={s.kind} ref={refByKind[s.kind]} className={`border rounded-2xl overflow-hidden ${s.accent}`}>
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="text-sm leading-none">{s.icon}</span>
                  <p className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wide">{s.label}</p>
                </div>
                <div className="bg-white p-2">
                  {s.kind === 'law' && (
                    <PageLawsList
                      scopeKey={panel.scopeKey}
                      flags={flags.map(f => ({
                        key: f.key,
                        label: f.label,
                        description: f.description,
                        count: f.count,
                        onViewClick: () => viewFlag(f),
                      }))}
                    />
                  )}
                  {s.kind === 'tasks' && <DynamicTasksSection scopeKey={panel.scopeKey} />}
                  {s.kind === 'notes' && <PageLawsNote scopeKey={panel.scopeKey} kind="note" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
