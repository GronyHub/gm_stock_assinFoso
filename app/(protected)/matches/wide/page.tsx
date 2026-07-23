'use client'
import { useState, useEffect, useMemo } from 'react'

type Match = { id: number; name: string }
type Row = { item_id: number; canonical_name: string; cf_group: string | null; product_type: string; matches: Match[] }

// Reference/editor for good<->service matches (see the Matches column on
// Goods & Services) -- mirrors the Alias Wide Table's left list/right detail
// pattern, but simpler: matches have no type or "move" concept, just add/
// remove pairs. This is an additional browsing tool, not a replacement for
// the inline MatchPicker already in each item's edit form.
export default function MatchesWidePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  const [addQuery, setAddQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const d = await fetch('/api/good-service-matches/wide').then(r => r.json())
    const updated = Array.isArray(d) ? d : []
    setRows(updated)
    setSelected(prev => prev ? (updated.find((r: Row) => r.item_id === prev.item_id) ?? null) : null)
    setLoading(false)
  }

  const groups = useMemo(() =>
    ['All', ...Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()],
    [rows]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      const matchGroup = !group || group === 'All' ? true : (r.cf_group ?? 'Ungrouped') === group
      const matchSearch = !q ||
        r.canonical_name.toLowerCase().includes(q) ||
        r.matches.some(m => m.name.toLowerCase().includes(q))
      return matchGroup && matchSearch
    })
  }, [rows, search, group])

  // Candidates to add a match to: items of the OPPOSITE product_type,
  // excluding anything already matched to the selected item.
  const addCandidates = useMemo(() => {
    if (!selected) return []
    const wantType = selected.product_type === 'service' ? 'goods' : 'service'
    const already = new Set(selected.matches.map(m => m.name.toLowerCase().trim()))
    const q = addQuery.trim().toLowerCase()
    return rows
      .filter(r => r.item_id !== selected.item_id)
      .filter(r => (wantType === 'service' ? r.product_type === 'service' : r.product_type !== 'service'))
      .filter(r => !already.has(r.canonical_name.toLowerCase().trim()))
      .filter(r => !q || r.canonical_name.toLowerCase().includes(q))
      .slice(0, 25)
  }, [rows, selected, addQuery])

  function selectRow(r: Row) {
    setSelected(r)
    setAddQuery('')
  }

  async function addMatch(candidateName: string) {
    if (!selected) return
    setAdding(true)
    const isService = selected.product_type === 'service'
    await fetch('/api/good-service-matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isService
        ? { good_name: candidateName, service_name: selected.canonical_name }
        : { good_name: selected.canonical_name, service_name: candidateName }),
    })
    setAdding(false)
    setAddQuery('')
    await load()
  }

  async function removeMatch(matchId: number) {
    setDeletingId(matchId)
    await fetch(`/api/good-service-matches/${matchId}`, { method: 'DELETE' })
    setDeletingId(null)
    await load()
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} items or matches…`}
            className="flex-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 text-gray-900 placeholder-gray-300" />
          <span className="text-[9px] text-gray-400 shrink-0">{filtered.length} shown</span>
        </div>
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

      <div className="flex flex-1 min-h-0">

        {/* LEFT: items */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">ITEM</th>
                <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">#</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.item_id} onClick={() => selectRow(r)}
                  className={`cursor-pointer border-b border-gray-100 transition ${selected?.item_id === r.item_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-1 py-0.5">
                    <p className="text-gray-900 font-semibold truncate max-w-[160px]">{r.canonical_name}</p>
                    <p className="text-[9px] text-gray-400">
                      <span className={r.product_type === 'service' ? 'text-purple-500' : 'text-green-600'}>
                        {r.product_type === 'service' ? 'Service' : 'Good'}
                      </span>
                      {r.cf_group && <> · {r.cf_group}</>}
                    </p>
                  </td>
                  <td className="px-1 py-0.5 text-right text-gray-400">{r.matches.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white flex flex-col">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select an item to edit its matches</p>
          ) : (
            <>
              {/* Header */}
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-[11px] font-bold text-gray-900">{selected.canonical_name}</p>
                <p className="text-[9px] text-gray-400">
                  {selected.product_type === 'service' ? 'Service' : 'Good'} · {selected.cf_group ?? 'No group'} · {selected.matches.length} match{selected.matches.length !== 1 ? 'es' : ''}
                </p>
              </div>

              {/* Add match */}
              <div className="px-2 py-1.5 border-b border-gray-200 shrink-0 space-y-1">
                <p className="text-[9px] font-semibold text-gray-500 uppercase">
                  Add match — search {selected.product_type === 'service' ? 'goods' : 'services'}
                </p>
                <input value={addQuery} onChange={e => setAddQuery(e.target.value)}
                  placeholder={`Search ${selected.product_type === 'service' ? 'goods' : 'services'}…`}
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 text-gray-900" />
                {addQuery.trim() && (
                  <div className="border border-gray-200 rounded bg-white max-h-32 overflow-y-auto">
                    {addCandidates.length === 0 ? (
                      <p className="text-[9px] text-gray-400 px-1.5 py-1">No matches found</p>
                    ) : addCandidates.map(c => (
                      <button key={c.item_id} onClick={() => addMatch(c.canonical_name)} disabled={adding}
                        className="w-full text-left px-1.5 py-1 text-[9px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0 truncate disabled:opacity-40">
                        {c.canonical_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Match list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {selected.matches.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-6">No matches yet</p>
                ) : (
                  <table className="w-full border-collapse text-[10px]">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr>
                        <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">
                          {selected.product_type === 'service' ? 'GOOD' : 'SERVICE'}
                        </th>
                        <th className="px-1.5 py-1 border-b border-gray-200 text-right font-semibold text-gray-500">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.matches.map(m => (
                        <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-1.5 py-0.5 text-gray-900 break-words">{m.name}</td>
                          <td className="px-1.5 py-0.5 text-right whitespace-nowrap">
                            <button onClick={() => removeMatch(m.id)} disabled={deletingId === m.id}
                              className="text-gray-300 hover:text-red-500 font-bold text-xs transition disabled:opacity-40">
                              {deletingId === m.id ? '…' : '×'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
