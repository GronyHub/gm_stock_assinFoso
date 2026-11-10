'use client'
import { useEffect, useLayoutEffect, useState } from 'react'

// The hub (/item) keeps its left sidebar and top staff bar on screen at all times, so every other page is shown INSIDE its right pane (in a frame).
// - Inside the frame: mark the page (the navigation bar and prompts are hidden: the hub already has them) and turn "back to the app" links into a close.
// - Opened on its own (a push notification, a typed address): send it into the hub so the sidebar and staff bar are there.
export const EMBED_PATHS = ['/laws', '/standards', '/how-to', '/owner-guide', '/handbook-announcements', '/notifications', '/penalties', '/cctv-review', '/barcode-labels']
const embeddable = (p: string) => EMBED_PATHS.some(e => p === e || p.startsWith(e + '/'))
const inFrame = () => { try { return window.self !== window.top } catch { return true } }

export default function FrameFlag() {
  useLayoutEffect(() => {
    if (inFrame()) { document.documentElement.classList.add('framed'); return }
    const { pathname, search } = window.location
    if (embeddable(pathname)) window.location.replace(`/item?open=${encodeURIComponent(pathname + search)}`)
  }, [])
  useEffect(() => {
    if (!inFrame()) return
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
      if (!a || a.target === '_blank') return
      const u = new URL(a.href, window.location.href)
      if (u.origin === window.location.origin && (u.pathname === '/item' || u.pathname === '/')) { e.preventDefault(); window.parent.postMessage({ type: 'close-embed' }, window.location.origin) }
    }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [])
  return null
}

// Prompts and background checks belong to the hub's own window, not to a page shown inside it.
export function NoFrame({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false)
  useEffect(() => { if (!inFrame()) setOk(true) }, [])
  return ok ? <>{children}</> : null
}
