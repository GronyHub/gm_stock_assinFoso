'use client'
import { useCallback, useLayoutEffect, useRef } from 'react'

// Phone ledger helper: shrinks a wide table so EVERY column fits the width of its wrapper
// (nothing hidden behind a sideways scroll). It measures the table at its natural width,
// then applies a CSS zoom (never below `minZoom`; below that it scrolls as before).
// Attach `wrapRef` to the overflow wrapper and `tableRef` to the <table>; pass anything that
// changes the table's content (rows, filter) in `deps` so it is re-measured.
export function useFitTable(deps: unknown[], minZoom = 0.45) {
  const wrap = useRef<HTMLElement | null>(null)
  const table = useRef<HTMLElement | null>(null)
  const fit = useCallback(() => {
    const w = wrap.current, t = table.current
    if (!w || !t) return
    const phone = window.matchMedia('(max-width: 640px)').matches
    t.style.zoom = ''
    if (!phone) return
    const avail = w.clientWidth, natural = t.scrollWidth
    if (avail > 0 && natural > avail) t.style.zoom = String(Math.max(minZoom, avail / natural))
  }, [minZoom])
  const wrapRef = useCallback((el: HTMLElement | null) => { wrap.current = el; fit() }, [fit])
  const tableRef = useCallback((el: HTMLElement | null) => { table.current = el; fit() }, [fit])
  useLayoutEffect(() => {
    fit()
    const w = wrap.current
    if (!w || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit())
    ro.observe(w)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, ...deps])
  return { wrapRef, tableRef }
}
