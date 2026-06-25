'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

type Props = { role: string }

const allTabs = [
  { href: '/sales',        label: 'Sales',    roles: ['owner','manager','staff'] },
  { href: '/bills',        label: 'Bills',    roles: ['owner','manager','staff'] },
  { href: '/stock/counts', label: 'Counts',   roles: ['owner','manager','staff'] },
  { href: '/transactions', label: 'DS',       roles: ['owner','manager','staff'] },
  { href: '/expenses',     label: 'Exp.',     roles: ['owner','manager','staff'] },
  { href: '/item',         label: 'Items',    roles: ['owner','manager','staff'] },
  { href: '/staff',        label: 'Staff',    roles: ['owner','manager','staff'] },
  { href: '/analysis',     label: 'Analysis', roles: ['owner','manager','staff'] },
  { href: '/rota',         label: 'Rota',     roles: ['owner','manager'] },
  { href: '/cash-at-bank', label: 'CAB',      roles: ['owner','manager'] },
  { href: '/logs',         label: 'Logs',     roles: ['owner','manager','staff'] },
  { href: '/users',        label: 'Users',    roles: ['owner'] },
  { href: '/profile',      label: 'Profile',  roles: ['owner','manager','staff'] },
]

export default function BottomNav({ role }: Props) {
  const pathname = usePathname()
  const tabs = allTabs.filter(t => t.roles.includes(role))
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex overflow-x-auto scrollbar-none px-0.5 py-0.5 gap-0">
        {tabs.map(t => (
          <Link key={t.href} href={t.href}
            className={`flex items-center justify-center px-1.5 py-1.5 rounded-lg shrink-0 transition-all
              ${isActive(t.href)
                ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200'
                : 'text-gray-400'}`}>
            <span className="text-[9px] font-semibold leading-none whitespace-nowrap">{t.label}</span>
          </Link>
        ))}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center justify-center px-1.5 py-1.5 rounded-lg shrink-0 transition-all text-red-400">
          <span className="text-[9px] font-semibold leading-none whitespace-nowrap">Sign out</span>
        </button>
      </div>
    </div>
  )
}
