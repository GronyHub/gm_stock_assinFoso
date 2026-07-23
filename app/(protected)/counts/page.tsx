'use client'
import { useState, useEffect, useMemo } from 'react'
import CountsTab from '../item/_components/CountsTab'

type Item = { id: number; item_name: string; cf_group: string | null; product_type?: string | null }

// Standalone home for Counts -- moved out of the main Grony Cash nav (it
// isn't a daily-glance destination: the actual daily-count entry flow is
// already surfaced via Joe's "Fix now" flags and the Opener's own "Go to
// Counts" step during clock-in). Those flows still land on the CountsTab
// embedded inside the Grony Cash tab (item/page.tsx, lossView 'counts') --
// unchanged, so they keep working. This page is a second, independent way
// in for anyone reaching for Counts directly, reusing the same component
// with its own self-fetched items/search/group state instead of the Grony
// Cash tab's shared controls.
export default function CountsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const groups = useMemo(() =>
    ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()],
    [items]
  )

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-200 bg-white">
        <select value={group ?? 'All'} onChange={e => setGroup(e.target.value === 'All' ? null : e.target.value)}
          className="text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg px-2 py-1 outline-none">
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
      </div>
      <div className="flex-1 min-h-0">
        <CountsTab items={items} groupFilter={group} search={search} violation={null} />
      </div>
    </div>
  )
}
