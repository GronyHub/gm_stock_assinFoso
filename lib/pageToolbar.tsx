'use client'
import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// A page's own controls (filters, search, columns...) moved up onto the top bar, to the right of the
// sales total and staff names, so the page's table starts at the very top. The Item hub registers the
// spot (an empty div in its desktop top-bar portal, see item/page.tsx); a page wraps its control row in
// <PageToolbar>. On phones the top bar is hidden, no spot is registered, and the row renders in place.
// Same module-level bridge as lib/navSlot.ts, since the spot and the page are not parent and child.
let currentEl: HTMLDivElement | null = null
const listeners = new Set<() => void>()

export function setPageToolbarEl(el: HTMLDivElement | null) {
  currentEl = el
  listeners.forEach(l => l())
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const usePageToolbarEl = () => useSyncExternalStore(subscribe, () => currentEl, () => null)

// inline: keep the row in the page anyway (e.g. Live Sale's "large screen" covers the top bar).
// grow: whether this row takes the spare width (a search box) or stays its natural size (a few buttons).
// Several pages' rows can share the spot; each lands in its own group, laid out left to right.
export default function PageToolbar({ children, inlineClassName, inline = false, grow = true }: {
  children: ReactNode; inlineClassName?: string; inline?: boolean; grow?: boolean
}) {
  const el = usePageToolbarEl()
  if (el && !inline) return createPortal(
    <div className={`flex flex-nowrap items-center justify-end gap-1.5 shrink-0 ${grow ? 'min-w-[12rem] flex-1' : ''}
      [&>select]:flex-none [&>select]:max-w-[170px] [&>div.relative]:min-w-[150px]`}>{children}</div>, el)
  return <div className={inlineClassName ?? 'flex items-center gap-1.5'}>{children}</div>
}
