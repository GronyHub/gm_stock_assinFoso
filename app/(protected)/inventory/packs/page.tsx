'use client'
import { useState, useEffect, useMemo } from 'react'

type Pack = {
  id: number
  pack_name: string
  pack_group: string | null
  units_per_pack: number
  unit_name: string | null
  single_item_name: string
  single_item_group: string | null
}

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await fetch('/api/packs').then(r => r.json())
      setPacks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Error loading packs:', e)
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return packs
    return packs.filter(p =>
      p.pack_name.toLowerCase().includes(q) ||
      p.single_item_name.toLowerCase().includes(q) ||
      p.pack_group?.toLowerCase().includes(q) ||
      p.single_item_group?.toLowerCase().includes(q)
    )
  }, [packs, search])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Search */}
      <div className="shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search pack or single item name…"
          className="w-full text-xs bg-gray-50 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
        />
        <p className="text-[9px] text-gray-400 mt-1">{filtered.length} of {packs.length} packs</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">
            {packs.length === 0 ? 'No pack conversions yet.' : 'No packs match your search.'}
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Pack Item</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Pack Group</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Units/Pack</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Unit Name</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Converts To</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Single Item Group</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900 font-medium">{p.pack_name}</td>
                  <td className="px-3 py-2 text-gray-600">{p.pack_group || '—'}</td>
                  <td className="px-3 py-2 text-gray-900 text-right font-medium">{p.units_per_pack}</td>
                  <td className="px-3 py-2 text-gray-600">{p.unit_name || '—'}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium">{p.single_item_name}</td>
                  <td className="px-3 py-2 text-gray-600">{p.single_item_group || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
