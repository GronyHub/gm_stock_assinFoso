'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/types'

export default function TabNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-3xl mx-auto flex overflow-x-auto">
        {CATEGORIES.map((c) => {
          const href = `/${c.slug}`
          const active = pathname === href
          return (
            <Link
              key={c.slug}
              href={href}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-black text-black dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {c.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
