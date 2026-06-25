'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = { role: string }

const allTabs = [
  { href: '/stock/count',  label: 'Flags',    staffShow: true },
  { href: '/sales',        label: 'Sales',    staffShow: true },
  { href: '/bills',        label: 'Bills',    staffShow: true },
  { href: '/stock/counts', label: 'Counts',   staffShow: true },
  { href: '/transactions', label: 'Day Book', staffShow: true },
  { href: '/expenses',     label: 'Expenses', staffShow: true },
  { href: '/item',         label: 'Items',    staffShow: true },
  { href: '/staff',        label: 'Staff',    staffShow: true },
  { href: '/analysis',     label: 'Analysis', staffShow: true },
  { href: '/cash-at-bank', label: 'CAB',      staffShow: false },
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
            className={`flex items-center justify-center px-2.5 py-1.5 rounded-lg shrink-0 transition-all
              ${isActive(t.href)
                ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-200'
                : 'text-gray-400'}`}>
            <span className="text-[9px] font-semibold leading-none whitespace-nowrap">{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
