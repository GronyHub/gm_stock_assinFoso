'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type Props = { role: string }

const row1Base = [
  { href: '/stock/count', label: 'Flags', icon: '\u{1F6A9}' },
  { href: '/sales', label: 'Sales', icon: '\u{1F9FE}' },
  { href: '/bills', label: 'Bills', icon: '\u{1F4CB}' },
  { href: '/expenses', label: 'Expenses', icon: '\u{1F4B8}' },
]

const row2All = [
  { href: '/cash-at-bank', label: 'CAB', icon: '\u{1F3E6}', staffHide: true },
  { href: '/analysis', label: 'Analysis', icon: '\u{1F4CA}', staffHide: false },
  { href: '/item', label: 'Inventory', icon: '\u{1F4E6}', staffHide: false },
]

function Tab({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href}
      className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors
        ${active ? 'text-blue-600' : 'text-gray-400 active:text-gray-500'}`}>
      <span className="text-[17px] leading-none">{icon}</span>
      <span className={`text-[9px] mt-0.5 font-medium leading-none tracking-tight
        ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
    </Link>
  )
}

export default function BottomNav({ role }: Props) {
  const pathname = usePathname()
  const isStaff = role === 'staff'
  const row2 = row2All.filter(t => !(isStaff && t.staffHide))
  const [overdueCount, setOverdueCount] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, overdue]) => setOverdueCount(daily.length + overdue.length))
      .catch(() => {})
  }, [])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const row1 = [
    ...row1Base,
    { href: '/stock/counts', label: 'Counts', icon: '\u{1F4DD}' },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5 px-2 pt-1.5 gap-x-1">
        {row1.map(t => <Tab key={t.href} {...t} active={isActive(t.href)} />)}
      </div>
      <div className={`grid px-2 pt-1 pb-1.5 gap-x-1 ${row2.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {row2.map(t => <Tab key={t.href} {...t} active={isActive(t.href)} />)}
      </div>
    </div>
  )
}

