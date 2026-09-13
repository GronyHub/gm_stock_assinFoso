'use client'
import { useState, useEffect, useMemo } from 'react'

type Alias = { id: number; name: string; type: string }
type Row = { item_id: number; canonical_name: string; cf_group: string | null; aliases: Alias[] }
type TableRow = { item_id: number; canonical_name: string; group: string | null; alias_name: string; alias_type: string; alias_id: number | null }
type TxLine = { date: string; quantity: string | null; item_price?: string | null; unit_price?: string | null; item_total: string | null; source: string }
type ItemDetails = {
  item: { id: number; canonical_name: string; status: string | null; cf_group: string | null; description: string | null }
  sales: TxLine[]
  bills: TxLine[]
}

export default function AliasEditorPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [movingAlias, setMovingAlias] = useState<{ id: number; name: string; fromItemId: number } | null>(null)
  const [moveSearch, setMoveSearch] = useState('')
  const [moving, setMoving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [merging, setMerging] = useState<number | null>(null)
  const [detailsItemId, setDetailsItemId] = useState<number | null>(null)
  const [details, setDetails] = useState<ItemDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function openDetails(itemId: number) {
    setDetailsItemId(itemId)
    setDetails(null)
    setDetailsLoading(true)
    const d = await fetch(`/api/aliases/item-transactions?itemId=${itemId}`).then(r => r.json()).catch(() => null)
    setDetails(d)
    setDetailsLoading(false)
  }

  async function load() {
    setLoading(true)
    const d = await fetch('/api/aliases/wide').then(r => r.json())
    setRows(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  const groups = useMemo(() =>
    ['All', ...Array.from(new Set(rows.map(r => r.cf_group ?? 'Ungrouped'))).sort()],
    [rows]
  )

  const tableRows: TableRow[] = useMemo(() => {
    const q = search.toLowerCase()
    const matchesSearch = (r: Row) => !q ||
      r.canonical_name.toLowerCase().includes(q) ||
      r.aliases.some(a => a.name.toLowerCase().includes(q))

    const matchesGroup = (r: Row) => !group || group === 'All' ? true : (r.cf_group ?? 'Ungrouped') === group

    const result: TableRow[] = []
    rows.forEach(r => {
      if (matchesSearch(r) && matchesGroup(r)) {
        if (r.aliases.length === 0) {
          result.push({ item_id: r.item_id, canonical_name: r.canonical_name, group: r.cf_group, alias_name: '—', alias_type: '—', alias_id: null })
        } else {
          r.aliases.forEach(a => {
            result.push({ item_id: r.item_id, canonical_name: r.canonical_name, group: r.cf_group, alias_name: a.name, alias_type: a.type, alias_id: a.id })
          })
        }
      }
    })
    return result
  }, [rows, search, group])

  const moveTargets = useMemo(() => {
    const q = moveSearch.toLowerCase()
    if (!movingAlias || !q) return rows.filter(r => r.item_id !== movingAlias?.fromItemId).slice(0, 40)
    return rows
      .filter(r => r.item_id !== movingAlias?.fromItemId &&
        (r.canonical_name.toLowerCase().includes(q) || (r.cf_group ?? '').toLowerCase().includes(q)))
      .slice(0, 40)
  }, [rows, moveSearch, movingAlias])

  async function deleteAlias(aliasId: number, name: string) {
    if (!confirm(`Delete alias "${name}"?`)) return
    setDeletingId(aliasId)
    await fetch(`/api/aliases/${aliasId}`, { method: 'DELETE' })
    setDeletingId(null)
    await load()
  }

  async function moveAlias(targetItemId: number, force = false) {
    if (!movingAlias) return
    setMoving(true)
    const res = await fetch(`/api/aliases/${movingAlias.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: targetItemId, force }),
    })
    setMoving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nMove anyway?`)) moveAlias(targetItemId, true)
      }
      return
    }
    setMovingAlias(null)
    setMoveSearch('')
    await load()
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* Top bar */}
      <div className="space-y-2 shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${rows.length} items or aliases…`}
          className="w-full text-[10px] bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 text-gray-900 placeholder-gray-300" />
        <div className="flex gap-1 overflow-x-auto">
          {groups.map(g => (
            <button key={g} onClick={() => setGroup(g === 'All' ? null : g)}
              className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition
                ${(g === 'All' && !group) || g === group ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {g}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-gray-400">{tableRows.length} shown</p>
      </div>

      {/* Move modal */}
      {movingAlias && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg max-w-sm w-full shadow-xl">
            <div className="px-3 py-2 bg-orange-50 border-b border-orange-200">
              <p className="text-[9px] text-orange-600 font-bold uppercase">Move Alias</p>
              <p className="text-[10px] font-semibold text-gray-900 mt-0.5 truncate">"{movingAlias.name}"</p>
            </div>
            <div className="p-2 space-y-2">
              <input value={moveSearch} onChange={e => setMoveSearch(e.target.value)}
                placeholder="Search canonical items…" autoFocus
                className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400" />
              <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded">
                {moveTargets.length === 0 ? (
                  <p className="text-[9px] text-gray-400 p-2 text-center">No items found</p>
                ) : (
                  moveTargets.map(r => (
                    <button key={r.item_id}
                      onClick={() => !moving && moveAlias(r.item_id)}
                      disabled={moving}
                      className="w-full text-left px-2 py-1 border-b border-gray-100 hover:bg-orange-50 text-[10px] transition disabled:opacity-50">
                      <p className="font-semibold text-gray-900">{r.canonical_name}</p>
                      {r.cf_group && <p className="text-[8px] text-gray-400">{r.cf_group}</p>}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 flex gap-1">
              <button onClick={() => { setMovingAlias(null); setMoveSearch('') }}
                className="flex-1 text-[9px] font-semibold text-gray-600 bg-gray-100 rounded py-1 hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {detailsItemId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={() => setDetailsItemId(null)}>
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-start justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <p className="text-[9px] text-blue-600 font-bold uppercase">Item Details</p>
                <p className="text-[10px] font-semibold text-gray-900 mt-0.5 truncate">{details?.item.canonical_name ?? '…'}</p>
                {details?.item.status && <p className="text-[8px] text-gray-500 mt-0.5">{details.item.status}{details.item.cf_group ? ` • ${details.item.cf_group}` : ''}</p>}
              </div>
              <button onClick={() => setDetailsItemId(null)} className="text-gray-400 hover:text-gray-700 font-bold text-sm shrink-0">×</button>
            </div>
            <div className="p-3 overflow-y-auto space-y-3">
              {detailsLoading ? (
                <p className="text-[9px] text-gray-400 text-center py-6">Loading…</p>
              ) : !details ? (
                <p className="text-[9px] text-red-500 text-center py-6">Failed to load</p>
              ) : (
                <>
                  {details.item.description && (
                    <div>
                      <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Notes</p>
                      <p className="text-[9px] text-gray-700 whitespace-pre-wrap">{details.item.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Sales ({details.sales.length})</p>
                    {details.sales.length === 0 ? (
                      <p className="text-[9px] text-gray-400">No sales records</p>
                    ) : (
                      <table className="w-full text-[9px]">
                        <tbody>
                          {details.sales.map((s, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-0.5 pr-2 text-gray-500 whitespace-nowrap">{s.date}</td>
                              <td className="py-0.5 pr-2 text-gray-700">qty {s.quantity ?? '—'}</td>
                              <td className="py-0.5 pr-2 text-gray-700">@ {s.item_price ?? '—'}</td>
                              <td className="py-0.5 pr-2 text-gray-900 font-semibold">₵{s.item_total ?? '—'}</td>
                              <td className="py-0.5 text-gray-400 text-[8px]">{s.source}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Bills ({details.bills.length})</p>
                    {details.bills.length === 0 ? (
                      <p className="text-[9px] text-gray-400">No bill records</p>
                    ) : (
                      <table className="w-full text-[9px]">
                        <tbody>
                          {details.bills.map((b, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-0.5 pr-2 text-gray-500 whitespace-nowrap">{b.date}</td>
                              <td className="py-0.5 pr-2 text-gray-700">qty {b.quantity ?? '—'}</td>
                              <td className="py-0.5 pr-2 text-gray-700">@ {b.unit_price ?? '—'}</td>
                              <td className="py-0.5 pr-2 text-gray-900 font-semibold">₵{b.item_total ?? '—'}</td>
                              <td className="py-0.5 text-gray-400 text-[8px]">{b.source}</td>
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
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0 border border-gray-200 rounded">
        <table className="w-full border-collapse text-[9px]">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="px-1.5 py-0.5 text-left font-semibold text-gray-600 border-b border-gray-300 whitespace-nowrap">Canonical</th>
              <th className="px-1.5 py-0.5 text-left font-semibold text-gray-600 border-b border-gray-300 whitespace-nowrap">Group</th>
              <th className="px-1.5 py-0.5 text-left font-semibold text-gray-600 border-b border-gray-300">Alias</th>
              <th className="px-1.5 py-0.5 text-left font-semibold text-gray-600 border-b border-gray-300 whitespace-nowrap">Type</th>
              <th className="px-1.5 py-0.5 text-right font-semibold text-gray-600 border-b border-gray-300 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-400">No items found</td>
              </tr>
            ) : (
              tableRows.map((row, idx) => (
                <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 transition ${row.group === 'Needs Review' ? 'bg-orange-50' : ''}`}>
                  <td className="px-1.5 py-0 truncate max-w-[200px]">
                    <button onClick={() => openDetails(row.item_id)}
                      className="font-semibold text-gray-900 hover:text-blue-600 hover:underline transition text-left">
                      {row.canonical_name}
                    </button>
                    {row.group === 'Needs Review' && (
                      <span className="ml-1 text-[7px] font-bold text-orange-600 uppercase">⚠ needs review</span>
                    )}
                  </td>
                  <td className="px-1.5 py-0 text-gray-500 text-[8px] truncate max-w-[80px]">{row.group ?? '—'}</td>
                  <td className="px-1.5 py-0 text-gray-700 truncate max-w-[250px]">{row.alias_name}</td>
                  <td className="px-1.5 py-0 text-gray-400 text-[8px] whitespace-nowrap">{row.alias_type}</td>
                  <td className="px-1.5 py-0 text-right whitespace-nowrap">
                    {row.alias_id && (
                      <>
                        <button onClick={() => { setMovingAlias({ id: row.alias_id!, name: row.alias_name, fromItemId: row.item_id }); setMoveSearch('') }}
                          className="text-[8px] text-orange-600 font-bold hover:text-orange-700 mr-1.5 transition">
                          Move
                        </button>
                        <button onClick={() => deleteAlias(row.alias_id!, row.alias_name)} disabled={deletingId === row.alias_id}
                          className="text-gray-300 hover:text-red-500 font-bold text-xs transition disabled:opacity-40">
                          {deletingId === row.alias_id ? '…' : '×'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="text-[8px] text-gray-400 shrink-0">
        <p>Click Move to reassign an alias to a different canonical item • × to delete an alias</p>
      </div>
    </div>
  )
}
