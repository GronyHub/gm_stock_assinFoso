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
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl h-[92dvh] sm:h-[85vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Laws & Tasks</h2>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => lawsPanel?.setOpenForm('law')}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition"
              title="Insert new law"
            >
              + Law
            </button>
            <button
              onClick={() => lawsPanel?.setOpenForm('task')}
              className="text-sm px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-semibold transition"
              title="Insert new task"
            >
              + Task
            </button>
            <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 text-xl font-light leading-none px-1" aria-label="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
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
            <p className="text-sm text-gray-500">Laws & Tasks not available</p>
          )}
        </div>
      </div>
    </div>
  )
}
