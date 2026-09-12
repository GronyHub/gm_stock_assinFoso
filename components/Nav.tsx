'use client'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import { setNavSlotEl } from '@/lib/navSlot'
import { setNavHeightPx } from '@/lib/navHeight'

export default function Nav() {
  // The Item hub is the one page with its own collapsible left sidebar
  // (see SidePaneContainer in item/page.tsx), which has its own "Sign out"
  // row -- so this bar's copy would just be a second, redundant way to do
  // the same thing there. Every other protected page has no such sidebar,
  // so this stays their only way to sign out. Also still what decides
  // full-width vs a centered max-w-5xl band, matching MainContainer's own
  // full-width exception for the Item hub.
  const isItemHub = usePathname() === '/item'
  // Reports this bar's real rendered height (via lib/navHeight.ts) so the
  // Item hub can size its own content area to "the rest of the viewport
  // below Nav" instead of assuming a fixed height -- this row grows on
  // desktop whenever the hub portals a second stacked bar into the slot
  // below, and a stale assumption would push the hub's own content past
  // the visible viewport. ResizeObserver (not just a mount-time read)
  // since what's portaled in can change size without this component
  // re-rendering at all (it owns no state of its own here).
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const report = () => setNavHeightPx(el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Squeezed down to a thin strip -- the item hub's own pane already shows
  // the signed-in name at its own top (see item/page.tsx's pane header), so
  // repeating it here was pure duplication. Shrinking this row is what lets
  // the actual app content -- PresentStaffBar, the tab switcher, the grid --
  // start right under it instead of losing a full row of vertical space to
  // branding on every page load.
  //
  // The slot (empty by default) is where the Item hub, on desktop, portals
  // its own "Critical, Do Now" bar + staff bar/tab switcher via
  // lib/navSlot.ts -- see item/page.tsx. flex-col (not a single row) since
  // the portaled content is two stacked bars, each laying out its own
  // children horizontally. No longer a fixed height (was h-7) since that
  // content can be taller than a bare row alone; py-1 lets the row grow to
  // fit whatever's actually portaled in, and shrinks back to the thin strip
  // when nothing is (every other page).
  return (
    <nav ref={navRef} className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className={`mx-auto px-4 py-1 flex items-center gap-3 min-h-7 ${isItemHub ? 'max-w-none' : 'max-w-5xl'}`}>
        <div ref={setNavSlotEl} className="flex-1 min-w-0 flex flex-col" />
        {!isItemHub && (
          <button onClick={() => { if (confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }}
            className="shrink-0 text-[11px] text-gray-500 hover:text-gray-900 transition">Sign out</button>
        )}
      </div>
    </nav>
  )
}
