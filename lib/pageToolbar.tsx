'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// A page's own controls (filters, search, columns...) moved up onto the top bar, to the right of the
// sales total and staff names, so the page's table starts at the very top. The Item hub registers the
// spot (an empty div in its desktop top-bar portal, see item/page.tsx); a page wraps its control row in
// <PageToolbar>. On phones the top bar is hidden, no spot is registered, and the row renders in place.
// Same module-level bridge as lib/navSlot.ts, since the spot and the page are not parent and child.
type Listener = (el: HTMLDivElement | null) => void
let currentEl: HTMLDivElement | null = null
const listeners = new Set<Listener>()

export function setPageToolbarEl(el: HTMLDivElement | null) {
  currentEl = el
  listeners.forEach(l => l(el))
}

function usePageToolbarEl(): HTMLDivElement | null {
  const [el, setEl] = useState(currentEl)
  useEffect(() => {
    setEl(currentEl)
    listeners.add(setEl)
    return () => { listeners.delete(setEl) }
  }, [])
  return el
}

export default function PageToolbar({ children, inlineClassName }: { children: ReactNode; inlineClassName?: string }) {
  const el = usePageToolbarEl()
  if (el) return createPortal(<div className="flex w-full min-w-0 items-center justify-end gap-1.5">{children}</div>, el)
  return <div className={inlineClassName ?? 'flex items-center gap-1.5'}>{children}</div>
}
