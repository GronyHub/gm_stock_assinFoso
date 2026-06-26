'use client'
import { useState, useEffect, useMemo } from 'react'

type Row = {
  item_id: number
  canonical_name: string
  cf_group: string | null
  aliases: string[]
}

export default function AliasWideTablePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/aliases/wide')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const groups = ['All', ...Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      const matchGroup = !group || group === 'All' ? true : (r.cf_group ?? 'Ungrouped') === group
      const matchSearch = !q ||
        r.canonical_name.toLowerCase().includes(q) ||
        r.aliases.some(a => a.toLowerCase().includes(q))
      return matchGroup && matchSearch
    })
  }, [rows, search, group])

  // Max aliases across filtered rows (for column count)
  const maxAliases = useMemo(() => Math.max(0, ...filtered.map(r => r.aliases.length)), [filtered])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} canonical items or aliases…`}
            className="flex-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 text-gray-900 placeholder-gray-300" />
          <span className="text-[9px] text-gray-400 shrink-0">{filtered.length} items</span>
        </div>
        {/* Group chips */}
        <div className="flex gap-1 px-2 pb-1.5 overflow-x-auto">
          {groups.map(g => (
            <button key={g} onClick={() => setGroup(g === 'All' ? null : g)}
              className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition
                ${(g === 'All' && !group) || g === group ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Wide table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="border-collapse text-[10px]" style={{ minWidth: `${200 + maxAliases * 160}px` }}>
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 sticky left-0 z-20 min-w-[180px]">
                CANONICAL NAME
              </th>
              <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 min-w-[90px]">
                GROUP
              </th>
              {Array.from({ length: maxAliases }, (_, i) => (
                <th key={i} className="text-left px-1.5 py-1 font-semibold text-gray-400 border-b border-r border-gray-200 whitespace-nowrap min-w-[150px]">
                  alias {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, ri) => (
              <tr key={row.item_id} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {/* Canonical name — sticky left */}
                <td className={`px-1.5 py-0.5 font-semibold text-gray-900 border-b border-r border-gray-100 sticky left-0 z-10 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  {row.canonical_name}
                </td>
                <td className="px-1.5 py-0.5 text-gray-400 border-b border-r border-gray-100 whitespace-nowrap">
                  {row.cf_group ?? '—'}
                </td>
                {Array.from({ length: maxAliases }, (_, i) => (
                  <td key={i} className="px-1.5 py-0.5 border-b border-r border-gray-100 whitespace-nowrap">
                    {row.aliases[i]
                      ? <span className={
                          row.aliases[i].startsWith('old') || row.aliases[i].startsWith('service-')
                            ? 'text-gray-300 italic'
                            : 'text-gray-700'
                        }>{row.aliases[i]}</span>
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
