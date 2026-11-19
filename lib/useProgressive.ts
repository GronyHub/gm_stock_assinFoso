import { useCallback, useEffect, useRef, useState } from 'react'

// Long lists (a thousand rows of bills or expenses) used to be drawn all at once, which froze the phone for seconds. This draws the first `step` rows and adds `step` more each time the
// marker placed after the list comes into view while scrolling. `resetKey` (a changed filter or search) starts again from the first rows.
export function useProgressive(resetKey: unknown, step = 40): { shown: number; setShown: (n: number) => void; sentinel: (el: HTMLElement | null) => void } {
  const [shown, setShown] = useState(step)
  const obs = useRef<IntersectionObserver | null>(null)
  useEffect(() => { setShown(step) }, [resetKey, step])
  const sentinel = useCallback((el: HTMLElement | null) => {
    obs.current?.disconnect(); obs.current = null
    if (!el || typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) setShown(n => n + step) }, { rootMargin: '700px' })
    o.observe(el); obs.current = o
  }, [step])
  return { shown, setShown, sentinel }
}
