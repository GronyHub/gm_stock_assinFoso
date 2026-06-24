'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

type NavUser = { name?: string | null; role?: string; username?: string }

const allLinks = [
  { href: '/stock/count', label: 'Flags', roles: ['owner','manager','staff'] },
  { href: '/item', label: 'Items', roles: ['owner','manager','staff'] },
  { href: '/sales', label: 'Sales', roles: ['owner','manager','staff'] },
  { href: '/bills', label: 'Bills', roles: ['owner','manager','staff'] },
  { href: '/expenses', label: 'Expenses', roles: ['owner','manager','staff'] },
  { href: '/rota', label: 'Rota', roles: ['owner','manager'] },
  { href: '/stock/counts', label: 'Counts', roles: ['owner','manager','staff'] },
  { href: '/cash-at-bank', label: 'Cash at Bank', roles: ['owner','manager'] },
  { href: '/staff', label: 'Staff', roles: ['owner','manager','staff'] },
  { href: '/analysis', label: 'Analysis', roles: ['owner','manager','staff'] },
  { href: '/logs', label: 'Logs', roles: ['owner','manager','staff'] },
  { href: '/users', label: 'Users', roles: ['owner'] },
]

export default function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const links = allLinks.filter(l => l.roles.includes(user.role || ''))
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
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

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(v => !v)}
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded-lg hover:bg-gray-100 transition">
            <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-14 right-0 bottom-0 w-64 bg-white shadow-xl flex flex-col overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
            <div className="p-4 space-y-1.5 flex-1">
              {links.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className={`block w-full text-sm font-semibold px-4 py-3 rounded-xl text-center transition
                    ${pathname === l.href || pathname.startsWith(l.href + '/')
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 space-y-1.5">
              <Link href="/profile" onClick={() => setOpen(false)}
                className="block w-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl py-3 text-center transition">
                My Profile
              </Link>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl py-3 transition">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

