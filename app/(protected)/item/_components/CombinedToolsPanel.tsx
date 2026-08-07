'use client'
import { useEffect, useRef } from 'react'
import { useToolsPanel, type ToolsPanelKind } from './ToolsPanelContext'
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
// Law, Tasks, and Notes all show at once, stacked in that order, in one
// scroll -- there used to be a tab switcher here that hid two of the three
// behind a click; that's gone per direct feedback ("I don't want to be
// clicking several buttons for information"). Each section is still
// exactly the same add/edit-capable component as before (PageLawsList/
// DynamicTasksSection/PageLawsNote, unchanged internally) -- only the
// layout changed, from "one visible at a time" to "all three, one below
// the other". Tapping a specific icon in PageToolIcons still scrolls this
// window straight to that section, as a convenience, without hiding the
// other two.
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

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900 truncate">{panel.scopeKey}</p>
        <button onClick={ctx.closePanel} title="Close"
          className="shrink-0 text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-1">×</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3">
        {SECTIONS.map(s => (
          <div key={s.kind} ref={refByKind[s.kind]} className={`border rounded-2xl overflow-hidden ${s.accent}`}>
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <span className="text-sm leading-none">{s.icon}</span>
              <p className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wide">{s.label}</p>
            </div>
            <div className="bg-white p-2">
              {s.kind === 'law' && <PageLawsList scopeKey={panel.scopeKey} />}
              {s.kind === 'tasks' && <DynamicTasksSection scopeKey={panel.scopeKey} />}
              {s.kind === 'notes' && <PageLawsNote scopeKey={panel.scopeKey} kind="note" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
