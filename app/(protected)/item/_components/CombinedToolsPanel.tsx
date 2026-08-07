'use client'
import { useToolsPanel, type ToolsPanelKind } from './ToolsPanelContext'
import DynamicTasksSection from './DynamicTasksSection'
import PageLawsNote from './PageLawsNote'
import PageLawsList from './PageLawsList'

const TABS: { kind: ToolsPanelKind; icon: string; label: string }[] = [
  { kind: 'law', icon: '⚖️', label: 'Law' },
  { kind: 'notes', icon: '📝', label: 'Notes' },
  { kind: 'tasks', icon: '✅', label: 'Tasks' },
]

// Mounted once, directly inside item/page.tsx's own content-area wrapper
// (the same `relative flex-1 min-w-0 min-h-0 flex flex-col` div every page's
// content already renders into) -- `absolute inset-0` here fills exactly
// that space, leaving the left pane (a flex sibling, outside this wrapper
// entirely) untouched and still fully usable. See ToolsPanelContext.tsx for
// why this needs to live here instead of inside PageToolIcons itself.
export default function CombinedToolsPanel() {
  const ctx = useToolsPanel()
  const panel = ctx?.panel
  if (!panel) return null

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2.5 pb-1 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900 truncate">{panel.scopeKey}</p>
        <button onClick={ctx.closePanel} title="Close"
          className="shrink-0 text-gray-400 hover:text-gray-600 text-xl font-bold leading-none px-1">×</button>
      </div>
      <div className="shrink-0 flex items-center gap-1 px-2 pt-1.5 border-b border-gray-100">
        {TABS.map(t => {
          const active = panel.kind === t.kind
          return (
            <button key={t.kind} onClick={() => ctx.openPanel(panel.scopeKey, t.kind)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-t-lg border-x border-t transition
                ${active
                  ? 'bg-white text-gray-900 border-gray-200 border-b border-b-white -mb-px'
                  : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
              <span className="text-sm leading-none">{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {panel.kind === 'law' && <PageLawsList scopeKey={panel.scopeKey} />}
        {panel.kind === 'notes' && <PageLawsNote scopeKey={panel.scopeKey} kind="note" />}
        {panel.kind === 'tasks' && <DynamicTasksSection scopeKey={panel.scopeKey} />}
      </div>
    </div>
  )
}
