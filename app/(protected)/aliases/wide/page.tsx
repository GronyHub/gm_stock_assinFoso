'use client'
import { useState, useEffect, useMemo } from 'react'

type Alias = { id: number; name: string; type: string }
type Row = { item_id: number; canonical_name: string; cf_group: string | null; aliases: Alias[] }

export default function AliasEditorPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  // Add alias
  const [newAlias, setNewAlias] = useState('')
  const [newType, setNewType] = useState('manual')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => { load() }, [])

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      const matchGroup = !group || group === 'All' ? true : (r.cf_group ?? 'Ungrouped') === group
      const matchSearch = !q ||
        r.canonical_name.toLowerCase().includes(q) ||
        r.aliases.some(a => a.name.toLowerCase().includes(q))
      return matchGroup && matchSearch
    })
  }, [rows, search, group])

  function selectRow(r: Row) {
    setSelected(r); setNewAlias(''); setAddError('')
  }

  async function addAlias() {
    if (!selected || !newAlias.trim()) return
    setAdding(true); setAddError('')
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: newAlias.trim(), item_id: selected.item_id, alias_type: newType }),
    })
    setAdding(false)
    if (res.ok) {
      setNewAlias('')
      // Refresh just this item's aliases by reloading all
      const d = await fetch('/api/aliases/wide').then(r => r.json())
      const updated = Array.isArray(d) ? d : []
      setRows(updated)
      const refreshed = updated.find((r: Row) => r.item_id === selected.item_id)
      if (refreshed) setSelected(refreshed)
    } else {
      setAddError('Failed to add — alias may already exist')
    }
  }

  async function deleteAlias(aliasId: number) {
    setDeletingId(aliasId)
    await fetch(`/api/aliases/${aliasId}`, { method: 'DELETE' })
    setDeletingId(null)
    const d = await fetch('/api/aliases/wide').then(r => r.json())
    const updated = Array.isArray(d) ? d : []
    setRows(updated)
    const refreshed = updated.find((r: Row) => r.item_id === selected?.item_id)
    if (refreshed) setSelected(refreshed)
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} items or aliases…`}
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

        {/* LEFT: canonical items */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">CANONICAL NAME</th>
                <th className="text-right px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">#</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.item_id} onClick={() => selectRow(r)}
                  className={`cursor-pointer border-b border-gray-100 transition ${selected?.item_id === r.item_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-1 py-0.5">
                    <p className="text-gray-900 font-semibold truncate max-w-[160px]">{r.canonical_name}</p>
                    {r.cf_group && <p className="text-[9px] text-gray-400">{r.cf_group}</p>}
                  </td>
                  <td className="px-1 py-0.5 text-right text-gray-400">{r.aliases.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT: alias editor */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white flex flex-col">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select an item to edit its aliases</p>
          ) : (
            <>
              {/* Header */}
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-[11px] font-bold text-gray-900">{selected.canonical_name}</p>
                <p className="text-[9px] text-gray-400">{selected.cf_group ?? 'No group'} · {selected.aliases.length} alias{selected.aliases.length !== 1 ? 'es' : ''}</p>
              </div>

              {/* Add alias form */}
              <div className="px-2 py-1.5 border-b border-gray-200 shrink-0 space-y-1">
                <p className="text-[9px] font-semibold text-gray-500 uppercase">Add alias</p>
                <input value={newAlias} onChange={e => setNewAlias(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAlias()}
                  placeholder="Type alias name…"
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 text-gray-900" />
                <div className="flex gap-1">
                  <select value={newType} onChange={e => setNewType(e.target.value)}
                    className="text-[9px] bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-600">
                    <option value="manual">manual</option>
                    <option value="canonical">canonical</option>
                    <option value="wic_service">wic_service</option>
                    <option value="gmc_service">gmc_service</option>
                    <option value="old_stop">old_stop</option>
                  </select>
                  <button onClick={addAlias} disabled={!newAlias.trim() || adding}
                    className="flex-1 bg-blue-600 text-white text-[10px] font-bold rounded py-0.5 disabled:opacity-40 hover:bg-blue-500 transition">
                    {adding ? 'Adding…' : '+ Add'}
                  </button>
                </div>
                {addError && <p className="text-[9px] text-red-500">{addError}</p>}
              </div>

              {/* Alias list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {selected.aliases.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-6">No aliases yet</p>
                ) : (
                  <table className="w-full border-collapse text-[10px]">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr>
                        <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ALIAS NAME</th>
                        <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">TYPE</th>
                        <th className="px-1.5 py-1 border-b border-gray-200" />
                      </tr>
                    </thead>
                    <tbody>
                      {selected.aliases.map(a => (
                        <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-1.5 py-0.5 text-gray-900 break-words">{a.name}</td>
                          <td className="px-1.5 py-0.5 text-gray-400 whitespace-nowrap">{a.type}</td>
                          <td className="px-1.5 py-0.5 text-right">
                            <button onClick={() => deleteAlias(a.id)}
                              disabled={deletingId === a.id}
                              className="text-gray-300 hover:text-red-500 font-bold text-xs transition disabled:opacity-40">
                              {deletingId === a.id ? '…' : '×'}
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
