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
  const flagsRef = useRef<HTMLDivElement>(null)
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

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900 truncate">{panel.scopeKey}</p>
        <button onClick={ctx.closePanel} title="Close"
          className="shrink-0 text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-1">×</button>
      </div>
      {/* Quick-jump row -- Law/Tasks/Notes plus this page's own flags, all
          in one scrollable line, each tap scrolling straight to its own
          section below instead of navigating anywhere. */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100 overflow-x-auto">
        {SECTIONS.map(s => (
          <button key={s.kind} onClick={() => refByKind[s.kind].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
            <span className="leading-none">{s.icon}</span>{s.label}
          </button>
        ))}
        {flags.map(f => (
          <button key={f.key} title={f.label}
            onClick={() => flagsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition
              ${f.count > 0 ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
            <span className="relative leading-none">
              {f.count > 0 ? '🚩' : '🏳️'}
              <span className={`absolute -bottom-1 -right-1 text-[6px] font-black leading-none rounded-sm px-[1px]
                ${f.count > 0 ? 'bg-white text-red-700' : 'bg-red-700 text-white'}`}>{f.letter}</span>
            </span>
            {f.count > 0 ? f.count : ''}
          </button>
        ))}
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
        {flags.length > 0 && (
          <div ref={flagsRef} className="space-y-2">
            {flags.map(f => (
              <div key={f.key} className={`border rounded-2xl overflow-hidden ${f.count > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="text-sm leading-none">{f.count > 0 ? '🚩' : '🏳️'}</span>
                  <p className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wide flex-1 min-w-0 truncate">{f.label}</p>
                  <span className={`shrink-0 text-[10px] font-bold ${f.count > 0 ? 'text-red-600' : 'text-gray-400'}`}>{f.count}</span>
                </div>
                <div className="bg-white p-2.5 space-y-2">
                  {f.description && <p className="text-[11px] text-gray-600" style={{ wordBreak: 'break-word' }}>{f.description}</p>}
                  <button onClick={() => viewFlag(f)}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                    View flagged records →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
