'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

type NavUser = { name?: string | null; role?: string; username?: string }

const allLinks = [
  { href: '/dashboard', label: 'Dashboard', roles: ['owner','manager','staff'] },
  { href: '/sales/new', label: '+ Receipt', roles: ['owner','manager','staff'] },
  { href: '/bills/new', label: '+ Bill', roles: ['owner','manager','staff'] },
  { href: '/expenses/new', label: '+ Expense', roles: ['owner','manager','staff'] },
  { href: '/stock/count', label: 'Count', roles: ['owner','manager','staff'] },
  { href: '/cash-at-bank', label: 'Cash at Bank', roles: ['owner','manager'] },
  { href: '/losses', label: 'Losses', roles: ['owner','manager','staff'] },
  { href: '/analysis', label: 'Analysis', roles: ['owner','manager','staff'] },
  { href: '/item', label: 'Item', roles: ['owner','manager','staff'] },
]

export default function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const links = allLinks.filter(l => l.roles.includes(user.role || ''))

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-bold text-white text-lg tracking-tight">Grony</Link>

        {/* Desktop links only */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${pathname === l.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-gray-400">{user.name}</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-400 hover:text-white transition">Sign out</button>
        </div>

        {/* Mobile: just show user name */}
        <span className="md:hidden text-sm text-gray-400">{user.name}</span>
      </div>
    </nav>
  )
}
