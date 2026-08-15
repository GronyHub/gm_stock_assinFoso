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
// Just the L/G/T/N piece on its own -- Items/Sales/Bills predate this hook
// and already keep their show/openForm/hideZeroFlags as their own separate
// useState calls (each needs its own custom `flags` list built inline, which
// doesn't fit the one-scopeKey-per-call inlineLaws() helper), so they can't
// switch to useLawsPanel() wholesale without a much bigger diff. This lets
// them pick up just the filter state/logic instead of hand-rolling their own
// copy a third time.
export function useLawFilterState(storageKey?: string) {
  const [activeFilters, setActiveFilters] = useState<Set<LawFilterKey>>(() => {
    if (typeof window === 'undefined' || !storageKey) return new Set()
    const stored = localStorage.getItem(storageKey)
    if (!stored) return new Set()
    try {
      return new Set(JSON.parse(stored) as LawFilterKey[])
    } catch {
      return new Set()
    }
  })

  function toggleFilter(key: LawFilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify(Array.from(activeFilters)))
  }, [activeFilters, storageKey])

  return { activeFilters, toggleFilter }
}

export function useLawsPanel(storageKey: string) {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(storageKey) === 'true'
  })
  const [refresh, setRefresh] = useState(0)
  const [openForm, setOpenForm] = useState<LawFormKind>(null)
  const [hideZeroFlags, setHideZeroFlags] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`${storageKey}:hideZeroFlags`) === 'true'
  })
  const { activeFilters, toggleFilter } = useLawFilterState(`${storageKey}:filters`)

  useEffect(() => {
    localStorage.setItem(storageKey, show.toString())
  }, [show, storageKey])

  useEffect(() => {
    localStorage.setItem(`${storageKey}:hideZeroFlags`, hideZeroFlags.toString())
  }, [hideZeroFlags, storageKey])

  return {
    show, setShow,
    refresh, bumpRefresh: () => setRefresh(r => r + 1),
    openForm, setOpenForm,
    hideZeroFlags, setHideZeroFlags,
    activeFilters, toggleFilter,
  }
}
