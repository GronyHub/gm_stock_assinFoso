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

  // Move alias
  const [movingAlias, setMovingAlias] = useState<Alias | null>(null)
  const [moveSearch, setMoveSearch] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const d = await fetch('/api/aliases/wide').then(r => r.json())
    const updated = Array.isArray(d) ? d : []
    setRows(updated)
    // keep selected in sync
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
        r.aliases.some(a => a.name.toLowerCase().includes(q))
      return matchGroup && matchSearch
    })
  }, [rows, search, group])

  const moveTargets = useMemo(() => {
    const q = moveSearch.toLowerCase()
    if (!q) return rows.filter(r => r.item_id !== selected?.item_id).slice(0, 40)
    return rows
      .filter(r => r.item_id !== selected?.item_id &&
        (r.canonical_name.toLowerCase().includes(q) || (r.cf_group ?? '').toLowerCase().includes(q)))
      .slice(0, 40)
  }, [rows, moveSearch, selected])

  function selectRow(r: Row) {
    setSelected(r); setNewAlias(''); setAddError(''); setMovingAlias(null); setMoveSearch('')
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
    if (res.ok) { setNewAlias(''); await load() }
    else setAddError('Failed — alias may already exist for this item')
  }

  async function deleteAlias(aliasId: number) {
    setDeletingId(aliasId)
    await fetch(`/api/aliases/${aliasId}`, { method: 'DELETE' })
    setDeletingId(null)
    await load()
  }

  async function moveAlias(targetItemId: number) {
    if (!movingAlias) return
    setMoving(true)
    await fetch(`/api/aliases/${movingAlias.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: targetItemId }),
    })
    setMoving(false)
    setMovingAlias(null)
    setMoveSearch('')
    await load()
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
          ) : movingAlias ? (
            /* ── MOVE MODE ── */
            <div className="flex flex-col h-full">
              <div className="px-2 py-1.5 bg-orange-50 border-b border-orange-200 shrink-0">
                <p className="text-[9px] text-orange-500 font-semibold uppercase">Moving alias</p>
                <p className="text-[10px] font-bold text-gray-900 break-words">{movingAlias.name}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Pick the correct canonical item below</p>
              </div>
              <div className="px-2 py-1.5 border-b border-gray-100 shrink-0">
                <input value={moveSearch} onChange={e => setMoveSearch(e.target.value)}
                  placeholder="Search canonical items…" autoFocus
                  className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400 text-gray-900" />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {moveTargets.map(r => (
                  <div key={r.item_id}
                    onClick={() => !moving && moveAlias(r.item_id)}
                    className="px-2 py-1.5 border-b border-gray-100 cursor-pointer hover:bg-orange-50 transition">
                    <p className="text-[10px] font-semibold text-gray-900">{r.canonical_name}</p>
                    {r.cf_group && <p className="text-[9px] text-gray-400">{r.cf_group}</p>}
                  </div>
                ))}
              </div>
              <div className="px-2 py-1.5 border-t border-gray-200 shrink-0">
                <button onClick={() => { setMovingAlias(null); setMoveSearch('') }}
                  className="w-full text-[10px] font-semibold text-gray-600 bg-gray-100 rounded py-1 hover:bg-gray-200 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── NORMAL MODE ── */
            <>
              {/* Header */}
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-[11px] font-bold text-gray-900">{selected.canonical_name}</p>
                <p className="text-[9px] text-gray-400">{selected.cf_group ?? 'No group'} · {selected.aliases.length} alias{selected.aliases.length !== 1 ? 'es' : ''}</p>
              </div>

              {/* Add alias */}
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
                        <th className="px-1.5 py-1 border-b border-gray-200 text-right font-semibold text-gray-500">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.aliases.map(a => (
                        <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-1.5 py-0.5 text-gray-900 break-words">{a.name}</td>
                          <td className="px-1.5 py-0.5 text-gray-400 whitespace-nowrap">{a.type}</td>
                          <td className="px-1.5 py-0.5 text-right whitespace-nowrap">
                            {/* Move */}
                            <button onClick={() => { setMovingAlias(a); setMoveSearch('') }}
                              className="text-[9px] text-orange-500 font-semibold hover:text-orange-600 mr-2 transition">
                              Move
                            </button>
                            {/* Delete */}
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
