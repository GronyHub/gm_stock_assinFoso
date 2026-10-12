'use client'
import { useCallback, useEffect, useState } from 'react'

// Phone table helper: `compact` is true on narrow screens (<= 640px) and
// `zoomFor(naturalWidth)` returns a CSS zoom that shrinks a fixed-width table
// to the width of its scroll wrapper (never below 0.5, so text stays legible).
// Attach `wrapRef` to the table's overflow wrapper.
export function useFitWidth() {
  const [compact, setCompact] = useState(false)
  const [wrapWidth, setWrapWidth] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setCompact(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const wrapRef = useCallback((el: HTMLElement | null) => {
    if (el) setWrapWidth(w => (w === el.clientWidth ? w : el.clientWidth))
  }, [])
  const zoomFor = (naturalWidth: number): number | undefined =>
    compact && wrapWidth > 0 && naturalWidth > 0 ? Math.min(1, Math.max(0.5, wrapWidth / naturalWidth)) : undefined
  return { compact, wrapRef, zoomFor }
}
