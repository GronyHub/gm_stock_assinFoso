'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = { role: string }

const allTabs = [
  { href: '/stock/count',  label: 'Flags',    icon: '🚩', staffShow: true },
  { href: '/sales',        label: 'Sales',     icon: '🧾', staffShow: true },
  { href: '/bills',        label: 'Bills',     icon: '📋', staffShow: true },
  { href: '/stock/counts', label: 'Counts',    icon: '📝', staffShow: true },
  { href: '/transactions', label: 'Day Book',  icon: '📒', staffShow: true },
  { href: '/expenses',     label: 'Expenses',  icon: '💸', staffShow: true },
  { href: '/item',         label: 'Items',     icon: '📦', staffShow: true },
  { href: '/staff',        label: 'Staff',     icon: '👥', staffShow: true },
  { href: '/analysis',     label: 'Analysis',  icon: '📊', staffShow: true },
  { href: '/cash-at-bank', label: 'CAB',       icon: '🏦', staffShow: false },
]

export default function BottomNav({ role }: Props) {
  const pathname = usePathname()
  const isStaff = role === 'staff'
  const tabs = allTabs.filter(t => !isStaff || t.staffShow)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex overflow-x-auto scrollbar-none px-1 py-1 gap-0">
        {tabs.map(t => (
          <Link key={t.href} href={t.href}
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg shrink-0 transition-all
              ${isActive(t.href)
                ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200'
                : 'text-gray-400'}`}>
            <span className="text-[13px] leading-none">{t.icon}</span>
            <span className={`text-[8px] mt-0.5 font-medium leading-none whitespace-nowrap
              ${isActive(t.href) ? 'text-blue-600' : 'text-gray-400'}`}>
              {t.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
