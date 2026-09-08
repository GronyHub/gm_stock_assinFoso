'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

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
  return (
    <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className={`mx-auto px-4 flex items-center justify-between h-7 ${isFullWidth ? 'max-w-none' : 'max-w-5xl'}`}>
        <Link href="/item" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Grony Multimedia" className="h-4 w-auto" />
        </Link>
        <button onClick={() => { if (confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }}
          className="text-[11px] text-gray-500 hover:text-gray-900 transition">Sign out</button>
      </div>
    </nav>
  )
}
