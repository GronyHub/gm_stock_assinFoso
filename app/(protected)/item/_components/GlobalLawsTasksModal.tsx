'use client'
import { useState, useEffect, useMemo } from 'react'
import PageLawsList, { type LawFormKind } from './PageLawsList'

type ScopeSummary = { scope: string; lawCount: number; taskCount: number }

// The one global "⚖️" entry point, replacing every page's own separate
// laws/tasks icon -- every scope_key that has ever had a law or an
// unattached task logged against it (see /api/law-scopes) shows up here as
// its own collapsible section, each rendering the exact same PageLawsList
// each page used to show inline, just gathered into one place instead of
// scattered one icon per page. Search narrows which page-sections are
// showing, not the laws/tasks text inside them.
export default function GlobalLawsTasksModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [scopes, setScopes] = useState<ScopeSummary[] | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Which scope's "+Law"/"+Task" form is open -- keyed by scope since
  // PageLawsList is mounted once per scope here (a real useLawsPanel() call
  // per scope isn't possible, hooks can't run a variable number of times),
  // so this one Record stands in for what would otherwise be N separate
  // hook instances.
  const [openFormByScope, setOpenFormByScope] = useState<Record<string, LawFormKind>>({})

  function load() {
    fetch('/api/law-scopes').then(r => r.ok ? r.json() : []).then(d => {
      setScopes(Array.isArray(d) ? d : [])
    }).catch(() => setScopes([]))
  }

  useEffect(() => { if (isOpen) load() }, [isOpen])

  const visibleScopes = useMemo(() => {
    if (!scopes) return []
    if (!search.trim()) return scopes
    const q = search.trim().toLowerCase()
    return scopes.filter(s => s.scope.toLowerCase().includes(q))
  }, [scopes, search])

  function toggle(scope: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope); else next.add(scope)
      return next
    })
  }

  function openAdd(scope: string, kind: 'law' | 'task') {
    setOpenFormByScope(prev => ({ ...prev, [scope]: kind }))
    setExpanded(prev => new Set(prev).add(scope))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90dvh] sm:h-[80vh] shadow-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-200 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">⚖️ Laws & Tasks</h2>
            <p className="text-sm text-slate-500 mt-1">Every page's rules and tasks, all in one place</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 px-6 py-3 border-b border-slate-100 bg-white">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages…"
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400" />
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
          <div className="p-4 space-y-2">
            {scopes === null ? (
              <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
            ) : visibleScopes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">
                {scopes.length === 0 ? 'No laws or tasks logged anywhere yet.' : 'No pages match that search.'}
              </p>
            ) : (
              visibleScopes.map(s => {
                const isOpenSection = expanded.has(s.scope)
                const total = s.lawCount + s.taskCount
                return (
                  <div key={s.scope} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="w-full flex items-center justify-between px-3 py-2.5">
                      <button type="button" onClick={() => toggle(s.scope)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                        <span className="text-slate-400 text-[10px] shrink-0">{isOpenSection ? '▴' : '▾'}</span>
                        <span className="text-sm font-semibold text-slate-800 truncate">{s.scope}</span>
                        <span className="text-xs text-slate-400 shrink-0">({total})</span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => openAdd(s.scope, 'law')}
                          className="text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors">
                          + Law
                        </button>
                        <button onClick={() => openAdd(s.scope, 'task')}
                          className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition-colors">
                          + Task
                        </button>
                      </div>
                    </div>
                    {isOpenSection && (
                      <div className="border-t border-slate-100 px-3 pb-3">
                        <PageLawsList
                          scopeKey={s.scope}
                          isItemsLaws={true}
                          onChange={load}
                          openForm={openFormByScope[s.scope] ?? null}
                          setOpenForm={v => setOpenFormByScope(prev => ({ ...prev, [s.scope]: v }))}
                          hideZeroFlags={false}
                          setHideZeroFlags={() => {}}
                          activeFilters={new Set()}
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
