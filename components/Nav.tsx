'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

type NavUser = { name?: string | null; role?: string; username?: string }

const allLinks = [
  { href: '/stock/count', label: 'Flags', roles: ['owner','manager','staff'] },
  { href: '/item', label: 'Items', roles: ['owner','manager','staff'] },
  { href: '/sales', label: 'Sales', roles: ['owner','manager','staff'] },
  { href: '/bills', label: 'Bills', roles: ['owner','manager','staff'] },
  { href: '/stock/counts', label: 'Counts', roles: ['owner','manager','staff'] },
  { href: '/transactions', label: 'Day Book', roles: ['owner','manager','staff'] },
  { href: '/expenses', label: 'Expenses', roles: ['owner','manager','staff'] },
  { href: '/rota', label: 'Rota', roles: ['owner','manager'] },
  { href: '/cash-at-bank', label: 'Cash at Bank', roles: ['owner','manager'] },
  { href: '/staff', label: 'Staff', roles: ['owner','manager','staff'] },
  { href: '/analysis', label: 'Analysis', roles: ['owner','manager','staff'] },
  { href: '/logs', label: 'Logs', roles: ['owner','manager','staff'] },
  { href: '/users', label: 'Users', roles: ['owner'] },
]

export default function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const links = allLinks.filter(l => l.roles.includes(user.role || ''))

  return (
    <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/stock/count" className="font-bold text-gray-900 text-lg tracking-tight">Grony</Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${(pathname === l.href || pathname.startsWith(l.href + '/')) ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.name}</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-600 hover:text-gray-900 transition">Sign out</button>
        </div>
      </div>
    </nav>
  )
}

