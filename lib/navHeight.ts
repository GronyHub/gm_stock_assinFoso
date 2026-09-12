'use client'
import { useEffect, useState } from 'react'

// Bridge between Nav.tsx (whose rendered height varies -- it grows on
// desktop when the Item hub portals extra rows into its slot, e.g. the
// "Critical, Do Now" bar stacked above the staff bar/tab switcher; see
// lib/navSlot.ts) and item/page.tsx, which sizes its own content area to
// "the rest of the viewport below Nav" and previously assumed a fixed
// 28px (Nav's old single-row height) -- stale the moment Nav grew a
// second row, pushing that content area's own bottom edge (and anything
// pinned to it, like the "show sidebar" restore button) below the fold.
// Same module-level pub/sub shape as navSlot.ts, for the same reason (Nav
// and the page are siblings under ProtectedLayout, not parent/child).
type Listener = (px: number) => void
let currentPx = 28
const listeners = new Set<Listener>()

export function setNavHeightPx(px: number) {
  if (px === currentPx) return
  currentPx = px
  listeners.forEach(l => l(px))
}

export function useNavHeightPx(): number {
  const [px, setPx] = useState(currentPx)
  useEffect(() => {
    setPx(currentPx)
    listeners.add(setPx)
    return () => { listeners.delete(setPx) }
  }, [])
  return px
}
