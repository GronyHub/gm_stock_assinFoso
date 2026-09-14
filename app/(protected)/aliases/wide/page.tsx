'use client'
import { useState, useEffect, useMemo } from 'react'

type Alias = { id: number; name: string; type: string; source: string | null }
type Row = { item_id: number; canonical_name: string; cf_group: string | null; needs_review: boolean; aliases: Alias[] }
type TxLine = { date: string; quantity: string | null; item_price?: string | null; unit_price?: string | null; item_total: string | null; source: string }
type ItemDetails = {
  item: { id: number; canonical_name: string; status: string | null; cf_group: string | null; description: string | null }
  sales: TxLine[]
  bills: TxLine[]
}

function rowHasLowConfidenceAlias(r: Row) {
  return r.aliases.some(a => a.source === 'prezoho_bulk_low_confidence')
}

export default function AliasEditorPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  // Independent boolean filters (not exclusive with each other or with the
  // group chips/search above) -- selecting one narrows the left list down
  // to exactly the items that need that kind of attention, so those can be
  // worked through one at a time without hunting for them in the full list.
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [aliasCheckOnly, setAliasCheckOnly] = useState(false)
  // Which item's aliases show in the right-hand panel -- a master/detail
  // split instead of one flat table repeating the canonical name once per
  // alias, which was what made the old layout hard to scan.
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [movingAlias, setMovingAlias] = useState<{ id: number; name: string; fromItemId: number } | null>(null)
  const [moveSearch, setMoveSearch] = useState('')
  const [moving, setMoving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [confirmingReviewId, setConfirmingReviewId] = useState<number | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null)
  const [itemActionError, setItemActionError] = useState('')
  // "Create standalone item" -- an alternative to picking an existing
  // canonical item in the Move modal, for when the alias genuinely isn't a
  // duplicate of anything already in the catalog. Pre-filled with the
  // alias's own text since that's usually exactly what the new item should
  // be called.
  const [standaloneMode, setStandaloneMode] = useState(false)
  const [standaloneName, setStandaloneName] = useState('')
  const [creatingStandalone, setCreatingStandalone] = useState(false)
  const [standaloneError, setStandaloneError] = useState('')
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

  const needsReviewCount = useMemo(() => rows.filter(r => r.needs_review).length, [rows])
  const aliasCheckCount = useMemo(() => rows.filter(rowHasLowConfidenceAlias).length, [rows])

  const filteredRows: Row[] = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      if (needsReviewOnly && !r.needs_review) return false
      if (aliasCheckOnly && !rowHasLowConfidenceAlias(r)) return false
      if (group && group !== 'All' && (r.cf_group ?? 'Ungrouped') !== group) return false
      if (q && !r.canonical_name.toLowerCase().includes(q) && !r.aliases.some(a => a.name.toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, search, group, needsReviewOnly, aliasCheckOnly])

  // Keep a selection valid across reloads/filter changes -- e.g. once every
  // alias on the selected item is confirmed it can drop out of an active
  // "Alias Needs Check" filter, which should clear the detail panel rather
  // than silently keep showing a now-filtered-out item.
  useEffect(() => {
    if (selectedItemId !== null && !filteredRows.some(r => r.item_id === selectedItemId)) {
      setSelectedItemId(null)
    }
  }, [filteredRows, selectedItemId])

  const selectedRow = useMemo(() => rows.find(r => r.item_id === selectedItemId) ?? null, [rows, selectedItemId])

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

  // Confirms a best-guess (source='prezoho_bulk_low_confidence') alias
  // match as correct -- flips just that alias's own source, no item change.
  async function confirmAlias(aliasId: number) {
    setConfirmingId(aliasId)
    await fetch('/api/aliases/confirm-low-confidence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aliasId }),
    })
    setConfirmingId(null)
    await load()
  }

  // Confirms an item's own needs_review flag as resolved -- the same
  // /api/flags/confirm-needs-review Item 360's own "Correct" radio uses.
  // Without this, the only way to actually clear the flag was to open
  // every item in Item 360 one at a time; this page could show and filter
  // by "Needs Review" but never resolve it.
  async function confirmItemReview(itemId: number) {
    setConfirmingReviewId(itemId)
    await fetch('/api/flags/confirm-needs-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })
    setConfirmingReviewId(null)
    await load()
  }

  // Outright removal for a stub that turns out not to be a real item name
  // at all (e.g. a catch-all sheet header like "PHOTO EQUIPMENTS") -- the
  // existing /api/items/[id] DELETE already refuses if it has any real
  // sales/bills/counts or something converts into it, so this is safe to
  // expose directly; the error message explains what to do instead
  // (merge) when it's blocked.
  async function deleteItem(itemId: number, name: string) {
    if (!confirm(`Delete "${name}" entirely? This can't be undone.`)) return
    setDeletingItemId(itemId)
    setItemActionError('')
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' })
    setDeletingItemId(null)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setItemActionError(d?.error ?? 'Could not delete item.')
      return
    }
    setSelectedItemId(null)
    await load()
  }

  function closeMoveModal() {
    setMovingAlias(null)
    setMoveSearch('')
    setStandaloneMode(false)
    setStandaloneName('')
    setStandaloneError('')
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
    closeMoveModal()
    await load()
  }

  // Creates a brand-new item from the alias's own text and moves the alias
  // onto it (alias_type: 'canonical', since it's now that item's real
  // name) -- the alternative to Move when nothing existing actually
  // matches. No mismatch-warning gate here (unlike moveAlias): a fresh item
  // named after the alias can never "mismatch" it.
  async function createStandalone() {
    if (!movingAlias || !standaloneName.trim()) return
    setCreatingStandalone(true)
    setStandaloneError('')
    try {
      const createRes = await fetch('/api/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: standaloneName.trim() }),
      })
      const created = await createRes.json().catch(() => null)
      if (!createRes.ok || !created?.id) {
        setStandaloneError(created?.error ?? 'Could not create item.')
        return
      }
      const moveRes = await fetch(`/api/aliases/${movingAlias.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: created.id, force: true, alias_type: 'canonical' }),
      })
      if (!moveRes.ok) {
        setStandaloneError('Item created, but moving the alias to it failed.')
        return
      }
      closeMoveModal()
      await load()
    } finally {
      setCreatingStandalone(false)
    }
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
        <div className="flex gap-3 items-center flex-wrap">
          <label className="flex items-center gap-1 cursor-pointer text-[9px] font-semibold text-orange-700">
            <input type="checkbox" checked={needsReviewOnly} onChange={e => setNeedsReviewOnly(e.target.checked)}
              className="cursor-pointer w-3 h-3" />
            ⚠ Needs Review ({needsReviewCount})
          </label>
          <label className="flex items-center gap-1 cursor-pointer text-[9px] font-semibold text-indigo-700">
            <input type="checkbox" checked={aliasCheckOnly} onChange={e => setAliasCheckOnly(e.target.checked)}
              className="cursor-pointer w-3 h-3" />
            🔍 Alias Needs Check ({aliasCheckCount})
          </label>
        </div>
        <p className="text-[9px] text-gray-400">{filteredRows.length} of {rows.length} items shown</p>
      </div>

      {/* Move modal */}
      {movingAlias && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg max-w-sm w-full shadow-xl">
            <div className="px-3 py-2 bg-orange-50 border-b border-orange-200">
              <p className="text-[9px] text-orange-600 font-bold uppercase">Move Alias</p>
              <p className="text-[10px] font-semibold text-gray-900 mt-0.5 truncate">"{movingAlias.name}"</p>
            </div>
            {!standaloneMode ? (
              <>
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
                  <button onClick={() => setStandaloneMode(true)}
                    className="w-full text-[9px] font-semibold text-indigo-600 bg-indigo-50 rounded py-1 hover:bg-indigo-100 transition">
                    + None of these — make it a standalone item
                  </button>
                </div>
                <div className="px-3 py-2 border-t border-gray-200 flex gap-1">
                  <button onClick={closeMoveModal}
                    className="flex-1 text-[9px] font-semibold text-gray-600 bg-gray-100 rounded py-1 hover:bg-gray-200 transition">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 space-y-2">
                  <p className="text-[9px] text-gray-500">Creates a brand-new item using this name, then moves the alias onto it.</p>
                  <input value={standaloneName} onChange={e => setStandaloneName(e.target.value)}
                    placeholder="New item name…" autoFocus
                    className="w-full text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400" />
                  {standaloneError && <p className="text-[9px] text-red-600">{standaloneError}</p>}
                </div>
                <div className="px-3 py-2 border-t border-gray-200 flex gap-1">
                  <button onClick={() => { setStandaloneMode(false); setStandaloneError('') }}
                    className="flex-1 text-[9px] font-semibold text-gray-600 bg-gray-100 rounded py-1 hover:bg-gray-200 transition">
                    Back
                  </button>
                  <button onClick={createStandalone} disabled={creatingStandalone || !standaloneName.trim()}
                    className="flex-1 text-[9px] font-semibold text-white bg-indigo-600 rounded py-1 hover:bg-indigo-700 transition disabled:opacity-50">
                    {creatingStandalone ? 'Creating…' : 'Create & Move'}
                  </button>
                </div>
              </>
            )}
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

      {/* Master/detail: canonical items on the left (one row each, never
          repeated), the selected item's own aliases + actions on the
          right. Replaces the old flat table that repeated the canonical
          name once per alias, which made a multi-alias item hard to scan
          and a single-alias one look identical to every other row. */}
      <div className="flex-1 flex gap-2 min-h-0">
        <div className="w-[45%] max-w-[280px] shrink-0 overflow-y-auto border border-gray-200 rounded">
          {filteredRows.length === 0 ? (
            <p className="text-[9px] text-gray-400 text-center py-6 px-2">No items found</p>
          ) : (
            filteredRows.map(r => {
              const lowConf = rowHasLowConfidenceAlias(r)
              const selected = r.item_id === selectedItemId
              return (
                <button key={r.item_id} onClick={() => setSelectedItemId(r.item_id)}
                  className={`w-full text-left px-2 py-1.5 border-b border-gray-100 transition
                    ${selected ? 'bg-blue-100' : r.needs_review ? 'bg-orange-50 hover:bg-orange-100' : lowConf ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}>
                  <p className="text-[10px] font-semibold text-gray-900 truncate">{r.canonical_name}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="text-[8px] text-gray-400 truncate">{r.cf_group ?? '—'}</span>
                    {r.needs_review && <span className="text-[7px] font-bold text-orange-600 uppercase whitespace-nowrap">⚠ review</span>}
                    {lowConf && <span className="text-[7px] font-bold text-indigo-600 uppercase whitespace-nowrap">🔍 check</span>}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="flex-1 overflow-y-auto border border-gray-200 rounded">
          {!selectedRow ? (
            <p className="text-[9px] text-gray-400 text-center py-10 px-3">← Select an item to see its aliases</p>
          ) : (
            <div>
              <div className="px-2 py-1.5 border-b border-gray-200 bg-gray-50 sticky top-0 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => openDetails(selectedRow.item_id)}
                    className="text-[10px] font-bold text-gray-900 hover:text-blue-600 hover:underline transition text-left truncate block">
                    {selectedRow.canonical_name}
                  </button>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="text-[8px] text-gray-500">{selectedRow.cf_group ?? '—'}</span>
                    {selectedRow.needs_review && <span className="text-[7px] font-bold text-orange-600 uppercase">⚠ needs review</span>}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button onClick={() => openDetails(selectedRow.item_id)}
                    className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition whitespace-nowrap">
                    Sales/Bills
                  </button>
                  <button onClick={() => deleteItem(selectedRow.item_id, selectedRow.canonical_name)} disabled={deletingItemId === selectedRow.item_id}
                    title="Delete this item outright (only if it has no sales/bills/counts)"
                    className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition whitespace-nowrap disabled:opacity-40">
                    {deletingItemId === selectedRow.item_id ? '…' : 'Delete Item'}
                  </button>
                </div>
              </div>
              {selectedRow.needs_review && (
                <div className="px-2 py-1.5 border-b border-gray-200 bg-orange-50 flex items-center justify-between gap-2">
                  <p className="text-[8px] text-orange-800">Confirm this is a real, standalone item -- if it's not (e.g. not an item name at all), delete it above instead.</p>
                  <button onClick={() => confirmItemReview(selectedRow.item_id)} disabled={confirmingReviewId === selectedRow.item_id}
                    className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-50">
                    {confirmingReviewId === selectedRow.item_id ? '…' : '✓ Correct'}
                  </button>
                </div>
              )}
              {itemActionError && <p className="px-2 py-1 text-[8px] text-red-600 bg-red-50 border-b border-red-100">{itemActionError}</p>}
              {selectedRow.aliases.length === 0 ? (
                <p className="text-[9px] text-gray-400 text-center py-6 px-2">No aliases on this item</p>
              ) : (
                selectedRow.aliases.map(a => (
                  <div key={a.id} className="px-2 py-1.5 border-b border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-800 truncate">
                        {a.name}
                        {a.source === 'prezoho_bulk_low_confidence' && (
                          <span className="ml-1 text-[7px] font-bold text-indigo-600 uppercase">🔍 needs check</span>
                        )}
                      </p>
                      <p className="text-[8px] text-gray-400">{a.type}</p>
                    </div>
                    <div className="shrink-0 whitespace-nowrap">
                      <button onClick={() => { setMovingAlias({ id: a.id, name: a.name, fromItemId: selectedRow.item_id }); setMoveSearch(''); setStandaloneName(a.name) }}
                        className="text-[8px] text-orange-600 font-bold hover:text-orange-700 mr-1.5 transition">
                        Move
                      </button>
                      {a.source === 'prezoho_bulk_low_confidence' && (
                        <button onClick={() => confirmAlias(a.id)} disabled={confirmingId === a.id}
                          title="Confirm this alias really does point at the right item"
                          className="text-[8px] text-indigo-600 font-bold hover:text-indigo-700 mr-1.5 transition disabled:opacity-40">
                          {confirmingId === a.id ? '…' : '✓ Confirm'}
                        </button>
                      )}
                      <button onClick={() => deleteAlias(a.id, a.name)} disabled={deletingId === a.id}
                        className="text-gray-300 hover:text-red-500 font-bold text-xs transition disabled:opacity-40">
                        {deletingId === a.id ? '…' : '×'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-[8px] text-gray-400 shrink-0">
        <p>Click an item on the left to see its aliases • ⚠ needs review = confirm it's a real standalone item, or Delete Item if it isn't one at all • 🔍 needs check = an alias matched by best guess during the pre-Zoho import, confirm it's right or Move it to the correct item • × deletes just one alias</p>
      </div>
    </div>
  )
}
