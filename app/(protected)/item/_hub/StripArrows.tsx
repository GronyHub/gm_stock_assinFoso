'use client'
import { useEffect, useState } from 'react'

// Arrows at the ends of the phone's Cash top row: they show only when there is more of the row to reveal in that direction,
// and tapping one slides the row. Dragging the row sideways works too.
export default function StripArrows() {
  const [edge, setEdge] = useState({ left: false, right: false })
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.cash-strip nav')
    if (!nav) return
    const update = () => setEdge({ left: nav.scrollLeft > 4, right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4 })
    update()
    nav.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(nav)
    const mo = new MutationObserver(update)
    mo.observe(nav, { childList: true, subtree: true })
    return () => { nav.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect() }
  }, [])
  const slide = (dir: -1 | 1) => { const nav = document.querySelector<HTMLElement>('.cash-strip nav'); nav?.scrollBy({ left: dir * nav.clientWidth * 0.7, behavior: 'smooth' }) }
  const cls = 'absolute top-0 z-10 flex h-full w-8 items-center justify-center text-[22px] font-bold text-white'
  return (<>
    {edge.left && <button type="button" aria-label="Show earlier tabs" onClick={() => slide(-1)} className={`${cls} left-0 bg-gradient-to-r from-[#00072d] via-[#00072d]/90 to-transparent`}>‹</button>}
    {edge.right && <button type="button" aria-label="Show more tabs" onClick={() => slide(1)} className={`${cls} right-0 bg-gradient-to-l from-[#00072d] via-[#00072d]/90 to-transparent`}>›</button>}
  </>)
}
