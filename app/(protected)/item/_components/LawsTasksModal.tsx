'use client'

import PageLawsList, { type LawFormKind } from './PageLawsList'
import type { LawFilterKey } from './useLawsPanel'

export function LawsTasksModal({ isOpen, onClose, lawsPanel }: {
  isOpen: boolean
  onClose: () => void
  lawsPanel?: {
    show: boolean
    setShow: (v: boolean | ((prev: boolean) => boolean)) => void
    openForm: LawFormKind
    setOpenForm: (v: LawFormKind) => void
    hideZeroFlags: boolean
    setHideZeroFlags: (v: boolean | ((prev: boolean) => boolean)) => void
    activeFilters: Set<LawFilterKey>
    toggleFilter: (key: LawFilterKey) => void
    bumpRefresh: () => void
  }
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-lg w-full max-w-4xl h-[90dvh] sm:h-[80vh] shadow-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Laws & Tasks</h2>
            <p className="text-sm text-slate-500 mt-1">Manage operational guidelines and task items</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => lawsPanel?.setOpenForm('law')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-sm rounded-md transition-colors border border-blue-200"
              title="Create new law"
            >
              <span className="text-base leading-none">+</span> Law
            </button>
            <button
              onClick={() => lawsPanel?.setOpenForm('task')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-sm rounded-md transition-colors border border-emerald-200"
              title="Create new task"
            >
              <span className="text-base leading-none">+</span> Task
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
          <div className="p-6">
            {lawsPanel ? (
              <PageLawsList
                scopeKey="Items"
                isItemsLaws={true}
                onChange={lawsPanel.bumpRefresh}
                openForm={lawsPanel.openForm}
                setOpenForm={lawsPanel.setOpenForm}
                hideZeroFlags={lawsPanel.hideZeroFlags}
                setHideZeroFlags={lawsPanel.setHideZeroFlags}
                activeFilters={lawsPanel.activeFilters}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">Laws & Tasks not available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
