'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { setNavSlotEl } from '@/lib/navSlot'

export default function Nav() {
  // Matches MainContainer's own full-width exception for the Item hub --
  // otherwise the logo/sign-out row would stay centered in a narrow band
  // while the page content below it stretches to fill the window.
  const isFullWidth = usePathname() === '/item'
  // Squeezed down to a thin strip -- the item hub's own pane already shows
  // the signed-in name at its own top (see item/page.tsx's pane header), so
  // repeating it here was pure duplication. Shrinking this row (and the
  // logo inside it) is what lets the actual app content -- PresentStaffBar,
  // the tab switcher, the grid -- start right under it instead of losing a
  // full row of vertical space to branding on every page load.
  //
  // The middle slot (empty by default) is where the Item hub, on desktop,
  // portals its own staff bar + tab switcher via lib/navSlot.ts -- see
  // item/page.tsx. No longer a fixed height (was h-7) since that content
  // can be taller than the bare logo/Sign out row alone; py-1 + items-center
  // lets the row grow to fit whatever's actually portaled in, and shrinks
  // back to the thin strip when nothing is (every other page).
  return (
    <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className={`mx-auto px-4 py-1 flex items-center gap-3 min-h-7 ${isFullWidth ? 'max-w-none' : 'max-w-5xl'}`}>
        <Link href="/item" className="flex items-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Grony Multimedia" className="h-4 w-auto" />
        </Link>
        <div ref={setNavSlotEl} className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto" />
        <button onClick={() => { if (confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }}
          className="shrink-0 text-[11px] text-gray-500 hover:text-gray-900 transition">Sign out</button>
      </div>
    </nav>
  )
}
