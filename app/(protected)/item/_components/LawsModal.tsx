'use client'
import PageLawsList, { type LawFormKind } from './PageLawsList'
import type { LawFilterKey } from './useLawsPanel'

export function LawsModal({ isOpen, onClose, panel }: {
  isOpen: boolean
  onClose: () => void
  panel: {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Laws, Tasks & Notes</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-semibold text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4">
          <PageLawsList
            scopeKey="liveSale"
            isItemsLaws={true}
            onChange={panel.bumpRefresh}
            openForm={panel.openForm}
            setOpenForm={panel.setOpenForm}
            hideZeroFlags={panel.hideZeroFlags}
            setHideZeroFlags={panel.setHideZeroFlags}
            activeFilters={panel.activeFilters}
          />
        </div>
      </div>
    </div>
  )
}
