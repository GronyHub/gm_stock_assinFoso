'use client'
import { useEffect, useState } from 'react'

// Bridge between Nav.tsx (the global top bar, rendered once per protected
// page by the layout) and whichever page wants to put content inside it --
// currently just the Item hub's desktop staff bar/tab switcher. They're
// siblings under ProtectedLayout, not parent and child, so a page can't
// just render into Nav's own JSX; instead Nav registers the DOM node for
// its own empty slot div here, and a page portals content into that node
// via useNavSlotEl(). Module-level rather than React context since Nav and
// the page tree don't share a common client-side provider today, and
// adding one just for this would mean restructuring the (server) layout.
type Listener = (el: HTMLDivElement | null) => void
let currentEl: HTMLDivElement | null = null
const listeners = new Set<Listener>()

export function setNavSlotEl(el: HTMLDivElement | null) {
  currentEl = el
  listeners.forEach(l => l(el))
}

export function useNavSlotEl(): HTMLDivElement | null {
  const [el, setEl] = useState(currentEl)
  useEffect(() => {
    setEl(currentEl)
    listeners.add(setEl)
    return () => { listeners.delete(setEl) }
  }, [])
  return el
}
