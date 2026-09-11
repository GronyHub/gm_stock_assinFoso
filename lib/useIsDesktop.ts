'use client'
import { useEffect, useState } from 'react'

// Matches Tailwind's `md` breakpoint (768px) -- the same cutoff Nav.tsx's
// `hidden md:block` already uses to decide whether the desktop top bar
// shows at all, so anything gated on this hook lines up with what's
// actually on screen. Starts false (matches server-rendered/mobile markup)
// and corrects itself once mounted, same as any other client-only viewport
// check -- a brief flash of the mobile layout on desktop's first paint is
// an accepted tradeoff for not hydration-mismatching.
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mql.matches)
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}
