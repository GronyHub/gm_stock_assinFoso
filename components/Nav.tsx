'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

type NavUser = { name?: string | null; role?: string; username?: string }

const allLinks = [
  { href: '/dashboard', label: 'Dashboard', roles: ['owner','manager','staff'] },
  { href: '/sales/new', label: '+ Receipt', roles: ['owner','manager','staff'] },
  { href: '/bills/new', label: '+ Bill', roles: ['owner','manager','staff'] },
  { href: '/expenses/new', label: '+ Expense', roles: ['owner','manager','staff'] },
  { href: '/stock', label: 'Stock', roles: ['owner','manager','staff'] },
  { href: '/stock/count', label: 'Count', roles: ['owner','manager','staff'] },
  { href: '/cash-at-bank', label: 'Cash at Bank', roles: ['owner','manager'] },
]

export default function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = allLinks.filter(l => l.roles.includes(user.role || ''))

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-bold text-white text-lg tracking-tight">Grony</Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link
              key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${pathname === l.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-gray-400">{user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-400 hover:text-white transition"
          >Sign out</button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-gray-400" onClick={() => setOpen(!open)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 pb-4 space-y-1">
          {links.map(l => (
            <Link
              key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition
                ${pathname === l.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-400">{user.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-red-400">Sign out</button>
          </div>
        </div>
      )}
    </nav>
  )
}
