'use client'
import { useState, useEffect } from 'react'
import type { LawFormKind } from './PageLawsList'

// The local state every page's own inline law panel needs -- show/hide,
// which global add-form is open, the zero-flag filter, and a refresh
// counter to remount PageLawsList after a change. One hook instead of
// redeclaring the same 4 useState calls (plus the show/hide localStorage
// effect) in every page that wants its own inline panel.
export function useLawsPanel(storageKey: string) {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(storageKey) === 'true'
  })
  const [refresh, setRefresh] = useState(0)
  const [openForm, setOpenForm] = useState<LawFormKind>(null)
  const [hideZeroFlags, setHideZeroFlags] = useState(false)

  useEffect(() => {
    localStorage.setItem(storageKey, show.toString())
  }, [show, storageKey])

  return {
    show, setShow,
    refresh, bumpRefresh: () => setRefresh(r => r + 1),
    openForm, setOpenForm,
    hideZeroFlags, setHideZeroFlags,
  }
}
