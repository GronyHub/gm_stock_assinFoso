'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

export type Tab = 'prezoho-sales' | 'prezoho-bills' | 'prezoho-receipts' | 'flagged' | 'ambiguous' | 'name-conflicts'

function fmtRate(v: string | null): string {
  if (v == null) return '—'
  const n = parseFloat(v)
  return isNaN(n) || n === 0 ? '—' : `₵${n.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
}
type UnresolvedRow = { name: string; cnt: number; confirmed: boolean }
type Item = { id: number; canonical_name: string; cf_group: string | null }
type AuditRow = { raw_name: string; item_id: number; canonical_name: string; source: string; cnt: number; warning: string }
type AmbiguousCandidate = { alias_id: number; alias_name: string; item_id: number; canonical_name: string; alias_type: string; source: string; line_count: number }
type AmbiguousGroup = { norm_name: string; candidates: AmbiguousCandidate[] }
type LeakRow = {
  alias_id: number; alias_name: string; alias_type: string; alias_source: string
  aliased_to_item_id: number; aliased_to_item_name: string; aliased_to_sp: string | null; aliased_to_cp: string | null
  conflicting_item_id: number; conflicting_item_name: string; conflicting_item_status: string | null
  conflicting_sp: string | null; conflicting_cp: string | null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'prezoho-sales',    label: 'Pre-Zoho Sales' },
  { id: 'prezoho-bills',    label: 'Pre-Zoho Bills' },
  { id: 'prezoho-receipts', label: 'Pre-Zoho Receipts' },
  { id: 'flagged',          label: '⚠ Flagged' },
  { id: 'ambiguous',        label: '⚠ Ambiguous' },
  { id: 'name-conflicts',   label: '⚠ Name Conflicts' },
]

// Compact item search dropdown for inline use inside a table cell -- lets a
// whole flag's review stay one flat table (list + fix action together) with
// no separate detail pane to click into for each row.
function InlineItemPicker({ items, value, onChange }: { items: Item[]; value: Item | null; onChange: (item: Item | null) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? items.filter(i => i.canonical_name.toLowerCase().includes(q) || (i.cf_group ?? '').toLowerCase().includes(q)) : items
    return list.slice(0, 20)
  }, [items, query])

  if (value) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-blue-700 truncate max-w-[130px]">{value.canonical_name}</span>
        <button onClick={() => onChange(null)} title="Change" className="text-[10px] text-gray-400 hover:text-red-500 leading-none">×</button>
      </div>
    )
  }
  return (
    <div className="relative">
      <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search item…"
        className="w-32 text-[10px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
      {open && (
        <div className="absolute z-20 top-full left-0 mt-0.5 w-48 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
          {matches.length === 0 ? <p className="text-[9px] text-gray-400 px-2 py-1.5">No matches</p> : matches.map(item => (
            <div key={item.id} onMouseDown={() => { onChange(item); setQuery(''); setOpen(false) }}
              className="px-2 py-1 text-[10px] text-gray-900 hover:bg-blue-50 cursor-pointer truncate">
              {item.canonical_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PreZohoPanel({ tab, items }: { tab: Tab; items: Item[] }) {
  const endpoint = tab === 'prezoho-bills' ? '/api/aliases/unresolved-bills'
    : tab === 'prezoho-receipts' ? '/api/aliases/unresolved-receipts'
    : '/api/aliases/unresolved'
  const source   = tab === 'prezoho-bills' ? 'bills' : tab === 'prezoho-receipts' ? 'invoices' : 'sales'

  const [rows, setRows]         = useState<UnresolvedRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [picked, setPicked]     = useState<Record<string, Item | null>>({})
  const [saving, setSaving]     = useState<string | null>(null)
  const [nameSearch, setNameSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(endpoint).then(r => r.json()).then(d => {
      const data = Array.isArray(d) ? d : []
      setRows(data.filter((r: UnresolvedRow) => !r.confirmed))
      setLoading(false)
    })
  }, [tab, endpoint])

  const display = useMemo(() => {
    if (!nameSearch) return rows
    return rows.filter(r => r.name.toLowerCase().includes(nameSearch.toLowerCase()))
  }, [rows, nameSearch])

  async function confirmMatch(row: UnresolvedRow, force = false) {
    const item = picked[row.name]
    if (!item) return
    setSaving(row.name)
    const res = await fetch('/api/aliases/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name: row.name, item_id: item.id, source, force }),
    })
    setSaving(null)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nMatch anyway?`)) return confirmMatch(row, true)
      }
      return
    }
    setRows(prev => prev.filter(r => r.name !== row.name))
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1.5 border-b border-gray-200 bg-white flex items-center gap-2">
        <span className="text-[9px] text-orange-500 font-bold">{display.length} pending</span>
        <input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder="Search…"
          className="text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 w-36" />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {display.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">Nothing pending. 🎉</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">RAW NAME</th>
                <th className="text-right px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CNT</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">MAP TO ITEM</th>
                <th className="px-2 py-0.5 border-b border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {display.map(r => (
                <tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-0 text-gray-900 max-w-[160px] truncate">{r.name}</td>
                  <td className="px-2 py-0 text-right text-gray-500">{r.cnt}</td>
                  <td className="px-2 py-0">
                    <InlineItemPicker items={items} value={picked[r.name] ?? null}
                      onChange={item => setPicked(p => ({ ...p, [r.name]: item }))} />
                  </td>
                  <td className="px-2 py-0">
                    <button onClick={() => confirmMatch(r)} disabled={!picked[r.name] || saving === r.name}
                      className="text-[9px] font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded px-2 py-1 transition">
                      {saving === r.name ? '…' : '✓ Confirm'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Every already-matched raw name that contradicts the item it's matched to
// (raw text says "singles", matched item is a "pack", or vice versa) --
// see /api/aliases/audit. Existing bad matches made before the sanity check
// existed don't get caught by it going forward, so this is the way to find
// and fix them retroactively.
function FlaggedPanel({ items }: { items: Item[] }) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Record<string, Item | null>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/aliases/audit').then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const key = (r: AuditRow) => `${r.source}::${r.raw_name}::${r.item_id}`

  function dismiss(r: AuditRow) {
    const k = key(r)
    setRows(prev => prev.filter(x => key(x) !== k))
    fetch('/api/aliases/dismissed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_type: 'flagged', review_key: k }),
    }).catch(() => {})
  }

  async function reassign(r: AuditRow, force = false) {
    const k = key(r)
    const item = picked[k]
    if (!item) return
    setSaving(k)
    const srcKey = r.source === 'bills' ? 'zoho_bills' : 'zoho_sales'
    const res = await fetch('/api/aliases/correct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_name: r.raw_name, item_id: item.id, source: srcKey, force }),
    })
    setSaving(null)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nMatch anyway?`)) return reassign(r, true)
      }
      return
    }
    setRows(prev => prev.filter(x => key(x) !== k))
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1.5 border-b border-gray-200 bg-white">
        <span className="text-[9px] text-red-600 font-bold">{rows.length} flagged mismatch{rows.length === 1 ? '' : 'es'}</span>
        <span className="text-[9px] text-gray-400 ml-2">raw name contradicts the item it&apos;s matched to (singles vs. pack)</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">No flagged mismatches found. 🎉</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">RAW NAME</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CURRENTLY MATCHED TO</th>
                <th className="text-right px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CNT</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">REASSIGN TO</th>
                <th className="px-2 py-0.5 border-b border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const k = key(r)
                return (
                  <tr key={k} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-0 text-gray-900 max-w-[120px] truncate">{r.raw_name}</td>
                    <td className="px-2 py-0 text-red-600 max-w-[120px] truncate">{r.canonical_name}</td>
                    <td className="px-2 py-0 text-right text-gray-500">{r.cnt}</td>
                    <td className="px-2 py-0">
                      <InlineItemPicker items={items} value={picked[k] ?? null}
                        onChange={item => setPicked(p => ({ ...p, [k]: item }))} />
                    </td>
                    <td className="px-2 py-0">
                      <div className="flex gap-1">
                        <button onClick={() => reassign(r)} disabled={!picked[k] || saving === k}
                          className="text-[9px] font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded px-2 py-1 transition">
                          {saving === k ? '…' : 'Reassign'}
                        </button>
                        <button onClick={() => dismiss(r)}
                          className="text-[9px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 transition">
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Alias names that map to more than one item -- exactly what
// /api/aliases/resweep skips rather than guess at. Resolving one here both
// moves any lines already mis-resolved to a losing candidate over to the
// one kept, and deletes the losing item_aliases rows, so the name maps to
// a single (correctly-resolved) item again for future confirms/sweeps.
function AmbiguousPanel() {
  const [groups, setGroups] = useState<AmbiguousGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/aliases/ambiguous').then(r => r.json()).then(d => {
      setGroups(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  function dismiss(group: AmbiguousGroup) {
    setGroups(prev => prev.filter(g => g.norm_name !== group.norm_name))
    fetch('/api/aliases/dismissed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_type: 'ambiguous', review_key: group.norm_name }),
    }).catch(() => {})
  }

  async function keep(group: AmbiguousGroup, keepItemId: number | null) {
    const busyKey = `${group.norm_name}::${keepItemId ?? 'delete'}`
    setResolving(busyKey)
    setLastResult(null)
    const res = await fetch('/api/aliases/ambiguous/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ norm_name: group.norm_name, keep_item_id: keepItemId }),
    })
    setResolving(null)
    if (!res.ok) return
    const d = await res.json()
    setLastResult(
      keepItemId
        ? `Moved ${d.salesLinesMoved} sales line${d.salesLinesMoved === 1 ? '' : 's'} and ${d.billLinesMoved} bill line${d.billLinesMoved === 1 ? '' : 's'} to the kept item; removed ${d.deletedCount} alias row${d.deletedCount === 1 ? '' : 's'}`
        : `Deleted ${d.deletedCount} unused alias row${d.deletedCount === 1 ? '' : 's'}`
    )
    setGroups(prev => prev.filter(g => g.norm_name !== group.norm_name))
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1.5 border-b border-gray-200 bg-white">
        <span className="text-[9px] text-red-600 font-bold">{groups.length} ambiguous name{groups.length === 1 ? '' : 's'}</span>
        <span className="text-[9px] text-gray-400 ml-2">same raw text maps to more than one item -- resweep skips these</span>
      </div>
      {lastResult && (
        <p className="shrink-0 text-[9px] text-gray-500 bg-gray-50 border-b border-gray-200 px-2 py-1">{lastResult}</p>
      )}
      <div className="flex-1 overflow-y-auto min-h-0">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">No ambiguous aliases found. 🎉</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">ALIAS NAME</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CANDIDATE ITEM</th>
                <th className="text-right px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">LINES</th>
                <th className="px-2 py-0.5 border-b border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {groups.flatMap(g => {
                const allZero = g.candidates.every(c => c.line_count === 0)
                return g.candidates.map(c => (
                  <tr key={c.alias_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-0 text-gray-900 max-w-[130px] truncate">{g.candidates[0]?.alias_name}</td>
                    <td className="px-2 py-0 text-gray-700 max-w-[130px] truncate">{c.canonical_name}</td>
                    <td className="px-2 py-0 text-right text-gray-500">{c.line_count}</td>
                    <td className="px-2 py-0">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => keep(g, c.item_id)} disabled={resolving !== null}
                          className="text-[9px] font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded px-2 py-1 transition">
                          {resolving === `${g.norm_name}::${c.item_id}` ? '…' : 'Keep this'}
                        </button>
                        {allZero && (
                          <button onClick={() => keep(g, null)} disabled={resolving !== null}
                            className="text-[9px] font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 rounded px-2 py-1 transition">
                            {resolving === `${g.norm_name}::delete` ? '…' : 'Delete all'}
                          </button>
                        )}
                        <button onClick={() => dismiss(g)}
                          className="text-[9px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 transition">
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// An alias whose text is identical to a *different* item's own canonical
// name -- the alias points sales/bills toward one item, while a second item
// sitting right there under that exact name never gets picked. Review-only:
// nothing here is auto-resolved, since the right fix differs per row (the
// alias may be simply wrong and need remapping to the right item, or the
// conflicting item may itself be the real duplicate that needs deleting/
// merging elsewhere, or the alias may just be fine as-is).
function NameConflictsPanel({ items }: { items: Item[] }) {
  const [rows, setRows] = useState<LeakRow[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Record<number, Item | null>>({})
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/aliases/leaks').then(r => r.json()).then(d => {
      setRows(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  function dismiss(aliasId: number) {
    setRows(prev => prev.filter(r => r.alias_id !== aliasId))
    fetch('/api/aliases/dismissed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_type: 'name_conflict', review_key: aliasId }),
    }).catch(() => {})
  }

  async function deleteAlias(row: LeakRow) {
    setBusy(row.alias_id)
    const res = await fetch('/api/aliases/leaks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_id: row.alias_id }),
    })
    setBusy(null)
    if (!res.ok) return
    setRows(prev => prev.filter(r => r.alias_id !== row.alias_id))
  }

  // Points the alias at whichever item was picked (usually the conflicting
  // item itself, since that's the one it should have meant) instead of its
  // current target -- also backfills any sales/bill lines already resolved
  // under the old (wrong) target so they move to the right item too.
  async function remap(row: LeakRow, force = false) {
    const item = picked[row.alias_id]
    if (!item) return
    setBusy(row.alias_id)
    const res = await fetch(`/api/aliases/${row.alias_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, force }),
    })
    setBusy(null)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_confirmation) {
        if (window.confirm(`${d.warning}\n\nRemap anyway?`)) return remap(row, true)
      }
      return
    }
    setRows(prev => prev.filter(r => r.alias_id !== row.alias_id))
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-2 py-1.5 border-b border-gray-200 bg-white">
        <span className="text-[9px] text-red-600 font-bold">{rows.length} name conflict{rows.length === 1 ? '' : 's'}</span>
        <span className="text-[9px] text-gray-400 ml-2">alias text also exists as a separate item&apos;s own canonical name</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">No name conflicts found. 🎉</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">ALIAS</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CURRENTLY POINTS TO</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CONFLICTS WITH</th>
                <th className="text-left px-2 py-0.5 font-semibold text-gray-500 border-b border-gray-200">REMAP TO</th>
                <th className="px-2 py-0.5 border-b border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.alias_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-0 text-gray-900 max-w-[110px] truncate">{r.alias_name}</td>
                  <td className="px-2 py-0 text-blue-600 max-w-[100px]">
                    <p className="truncate">{r.aliased_to_item_name}</p>
                    <p className="text-[8px] text-gray-400">SP {fmtRate(r.aliased_to_sp)} · CP {fmtRate(r.aliased_to_cp)}</p>
                  </td>
                  <td className="px-2 py-0 max-w-[110px]">
                    <p className="text-gray-900 truncate">{r.conflicting_item_name}</p>
                    <p className="text-[8px] text-gray-400">SP {fmtRate(r.conflicting_sp)} · CP {fmtRate(r.conflicting_cp)}</p>
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                      r.conflicting_item_status === 'Active' ? 'bg-red-100 text-red-700'
                      : r.conflicting_item_status ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'}`}>
                      {r.conflicting_item_status ?? 'no status'}
                    </span>
                  </td>
                  <td className="px-2 py-0">
                    <InlineItemPicker items={items} value={picked[r.alias_id] ?? null}
                      onChange={item => setPicked(p => ({ ...p, [r.alias_id]: item }))} />
                  </td>
                  <td className="px-2 py-0">
                    <div className="flex gap-1">
                      <button onClick={() => remap(r)} disabled={!picked[r.alias_id] || busy === r.alias_id}
                        className="text-[9px] font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded px-2 py-1 transition">
                        {busy === r.alias_id ? '…' : 'Remap'}
                      </button>
                      <button onClick={() => deleteAlias(r)} disabled={busy === r.alias_id}
                        className="text-[9px] font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded px-2 py-1 transition">
                        Delete
                      </button>
                      <button onClick={() => dismiss(r.alias_id)}
                        className="text-[9px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 transition">
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

type Props = { tab: Tab }

// Each flag pill on the Items page now points straight at one of these --
// no tab bar to jump to a different flag from in here. The 6 checks (Pre-
// Zoho Sales/Bills/Receipts, Flagged, Ambiguous, Name Conflicts) are all
// genuinely different data-integrity checks, not duplicates of each other,
// so each keeps its own dedicated page instead of sharing one tabbed screen.
export default function AliasesTab({ tab }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [resweeping, setResweeping] = useState(false)
  const [resweepResult, setResweepResult] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/items/all').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d.map((i: any) => ({ id: i.id, canonical_name: i.name, cf_group: i.group })) : [])
    })
  }, [])

  async function resweep() {
    setResweeping(true); setResweepResult(null)
    const res = await fetch('/api/aliases/resweep', { method: 'POST' })
    setResweeping(false)
    if (!res.ok) { setResweepResult('Failed — try again'); return }
    const d = await res.json()
    const parts = [
      `${d.salesLinesUpdated} sales line${d.salesLinesUpdated === 1 ? '' : 's'}`,
      `${d.billLinesUpdated} bill line${d.billLinesUpdated === 1 ? '' : 's'}`,
      `${d.invoiceLinesUpdated} receipt line${d.invoiceLinesUpdated === 1 ? '' : 's'}`,
    ]
    let msg = `Re-swept: ${parts.join(', ')} updated`
    if (d.ambiguousNamesSkipped?.length) msg += ` · ${d.ambiguousNamesSkipped.length} ambiguous name${d.ambiguousNamesSkipped.length === 1 ? '' : 's'} skipped`
    setResweepResult(msg)
    setRefreshKey(k => k + 1)
  }

  const tabLabel = TABS.find(t => t.id === tab)?.label ?? tab

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-gray-200 bg-white px-2 py-1.5 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] font-bold text-gray-700">{tabLabel}</p>
          <div className="flex items-center gap-1">
            <button onClick={resweep} disabled={resweeping}
              title="Re-apply every existing alias against current sales/bill lines"
              className="text-[9px] text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded hover:bg-green-100 disabled:opacity-50">
              {resweeping ? 'Re-sweeping…' : '⟳ Re-sweep aliases'}
            </button>
            <Link href="/aliases/wide" className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
              Wide Table →
            </Link>
          </div>
        </div>
        {resweepResult && (
          <p className="text-[9px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">{resweepResult}</p>
        )}
      </div>
      {tab === 'flagged'
        ? <FlaggedPanel key={refreshKey} items={items} />
        : tab === 'ambiguous'
        ? <AmbiguousPanel key={refreshKey} />
        : tab === 'name-conflicts'
        ? <NameConflictsPanel key={refreshKey} items={items} />
        : <PreZohoPanel key={`${tab}-${refreshKey}`} tab={tab} items={items} />
      }
    </div>
  )
}
