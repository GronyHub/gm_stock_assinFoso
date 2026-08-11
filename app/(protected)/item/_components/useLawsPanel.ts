'use client'
import { useState, useEffect } from 'react'
import type { LawFormKind } from './PageLawsList'

// Which row categories the "L / G / T / N" checkboxes narrow the panel
// down to -- see LawsToggleBar/PageLawsList. Empty set = no filter, show
// everything (the default); any keys present = show only those categories.
export type LawFilterKey = 'L' | 'G' | 'T' | 'N'

// The local state every page's own inline law panel needs -- show/hide,
// which global add-form is open, the zero-flag filter, which row-category
// checkboxes are active, and a refresh counter to remount PageLawsList
// after a change. One hook instead of redeclaring the same handful of
// useState calls (plus the show/hide localStorage effect) in every page
// that wants its own inline panel.
export function useLawsPanel(storageKey: string) {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(storageKey) === 'true'
  })
  const [refresh, setRefresh] = useState(0)
  const [openForm, setOpenForm] = useState<LawFormKind>(null)
  const [hideZeroFlags, setHideZeroFlags] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<LawFilterKey>>(new Set())

  useEffect(() => {
    localStorage.setItem(storageKey, show.toString())
  }, [show, storageKey])

  function toggleFilter(key: LawFilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return {
    show, setShow,
    refresh, bumpRefresh: () => setRefresh(r => r + 1),
    openForm, setOpenForm,
    hideZeroFlags, setHideZeroFlags,
    activeFilters, toggleFilter,
  }
}
