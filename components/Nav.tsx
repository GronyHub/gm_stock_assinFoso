'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

type NavUser = { name?: string | null; role?: string; username?: string }

export default function Nav({ user }: { user: NavUser }) {
  // Matches MainContainer's own full-width exception for the Item hub --
  // otherwise the logo/sign-out row would stay centered in a narrow band
  // while the page content below it stretches to fill the window.
  const isFullWidth = usePathname() === '/item'
  return (
    <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className={`mx-auto px-4 flex items-center justify-between h-14 ${isFullWidth ? 'max-w-none' : 'max-w-5xl'}`}>
        <Link href="/item" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Grony Multimedia" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user.name}</span>
          <button onClick={() => { if (confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }}
            className="text-sm text-gray-600 hover:text-gray-900 transition">Sign out</button>
        </div>
      </div>
    </nav>
  )
}
