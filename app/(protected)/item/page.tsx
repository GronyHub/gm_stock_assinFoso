'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type Item = {
  id: number
  item_name: string
  cf_group: string | null
  selling_rate: string | null
  purchase_rate: string | null
  units_per_pack: string | null
  unit_name: string | null
  calculated_soh: number
}

type DayRow = {
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
}

type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

const EMPTY_FORM = {
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '',
}

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? val : n % 1 === 0 ? n.toString() : n.toFixed(2)
}


function numVal(val: string | null) { return val ? parseFloat(val) || 0 : 0 }

function computeRows(rows: DayRow[]): ComputedRow[] {
  const result: ComputedRow[] = []
  let prev: number | null = null
  for (const row of rows) {
    const bills = numVal(row.bills_qty), wic = numVal(row.wic_qty), gmc = numVal(row.gmc_qty)
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    let expected: number | null = null, loss: number | null = null
    if (prev === null) {
      if (counted !== null) { prev = counted; expected = counted }
    } else {
      expected = parseFloat((prev + bills - wic - gmc).toFixed(4))
      if (counted !== null) { loss = parseFloat((expected - counted).toFixed(4)); prev = counted }
      else prev = expected
    }
    result.push({ ...row, expected_soh: expected, loss })
  }
  return result.reverse()
}

function fmtQ(val: string | null) {
  if (!val) return <span className="text-gray-300">—</span>
  const n = parseFloat(val)
  return <>{n % 1 === 0 ? n : n.toFixed(2)}</>
}

function fmtN(val: number | null) {
  if (val === null) return <span className="text-gray-300">—</span>
  return <>{val % 1 === 0 ? val : val.toFixed(2)}</>
}

function sohFmt(item: Item) {
  const n = Number(item.calculated_soh)
  return n % 1 === 0 ? n.toString() : n.toFixed(2)
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  // Accordion state
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [lossData, setLossData] = useState<Map<number, ComputedRow[]>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set())
  const [expandingAll, setExpandingAll] = useState(false)

  // Edit state per item
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/items').then(r => r.json()).then(data => { setItems(data); setLoading(false) })
  }, [])

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i => {
      const matchGroup = !group || group === 'All' ? true : (i.cf_group ?? 'Ungrouped') === group
      return matchGroup && i.item_name.toLowerCase().includes(q)
    })
  }, [items, search, group])

  const allExpanded = filtered.length > 0 && filtered.every(i => expanded.has(i.id))

  const fetchLoss = useCallback(async (id: number) => {
    if (lossData.has(id)) return
    setLoadingIds(prev => new Set(prev).add(id))
    const res = await fetch(`/api/losses/${id}`)
    const data: DayRow[] = await res.json()
    setLossData(prev => new Map(prev).set(id, computeRows(data)))
    setLoadingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [lossData])

  function toggleItem(id: number) {
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else { s.add(id); fetchLoss(id) }
      return s
    })
  }

  async function expandAll() {
    setExpandingAll(true)
    const toFetch = filtered.filter(i => !lossData.has(i.id))
    await Promise.all(toFetch.map(async i => {
      const res = await fetch(`/api/losses/${i.id}`)
      const data: DayRow[] = await res.json()
      setLossData(prev => new Map(prev).set(i.id, computeRows(data)))
    }))
    setExpanded(prev => {
      const s = new Set(prev)
      filtered.forEach(i => s.add(i.id))
      return s
    })
    setExpandingAll(false)
  }

  function collapseAll() {
    setExpanded(prev => {
      const s = new Set(prev)
      filtered.forEach(i => s.delete(i.id))
      return s
    })
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditForm({
      item_name: item.item_name,
      cf_group: item.cf_group ?? '',
      selling_rate: item.selling_rate ? parseFloat(item.selling_rate).toString() : '',
      purchase_rate: item.purchase_rate ? parseFloat(item.purchase_rate).toString() : '',
      units_per_pack: item.units_per_pack ? parseFloat(item.units_per_pack).toString() : '',
      unit_name: item.unit_name ?? '',
    })
  }

  async function saveEdit(item: Item) {
    setSaving(true)
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: editForm.item_name || undefined,
        cf_group: editForm.cf_group || null,
        selling_rate: editForm.selling_rate ? parseFloat(editForm.selling_rate) : null,
        purchase_rate: editForm.purchase_rate ? parseFloat(editForm.purchase_rate) : null,
        units_per_pack: editForm.units_per_pack ? parseFloat(editForm.units_per_pack) : null,
        unit_name: editForm.unit_name || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updated, calculated_soh: i.calculated_soh } : i))
      setEditingId(null)
    }
  }

  async function saveAdd() {
    if (!addForm.item_name.trim()) return
    setAdding(true)
    const res = await fetch('/api/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: addForm.item_name.trim(),
        cf_group: addForm.cf_group || null,
        selling_rate: addForm.selling_rate ? parseFloat(addForm.selling_rate) : null,
        purchase_rate: addForm.purchase_rate ? parseFloat(addForm.purchase_rate) : null,
        units_per_pack: addForm.units_per_pack ? parseFloat(addForm.units_per_pack) : null,
        unit_name: addForm.unit_name || null,
      }),
    })
    setAdding(false)
    if (res.ok) {
      const newItem = await res.json()
      setItems(prev => [...prev, { ...newItem, calculated_soh: 0 }])
      setAddForm(EMPTY_FORM)
      setShowAdd(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} of {items.length} items</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + Add Item
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white border border-blue-300 rounded-xl p-4 space-y-3 mb-3">
          <p className="text-gray-900 font-semibold">New Item</p>
          <ItemForm form={addForm} onChange={setAddForm} groups={groups.filter(g => g !== 'All')} />
          <div className="flex gap-2">
            <button onClick={saveAdd} disabled={adding || !addForm.item_name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
              {adding ? 'Saving...' : 'Save Item'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search items..."
        className="w-full mb-2 bg-white border border-gray-200 rounded-xl px-4 py-3 text-base
          text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />

      {/* Group filter + Expand All */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
          {groups.map(g => (
            <button key={g} onClick={() => setGroup(g === 'All' ? null : g)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition
                ${(g === 'All' && !group) || g === group ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-700'}`}>
              {g}
            </button>
          ))}
        </div>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          disabled={expandingAll}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 transition whitespace-nowrap">
          {expandingAll ? 'Loading...' : allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Accordion list */}
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No items found.</p>}
        {filtered.map(item => {
          const isOpen = expanded.has(item.id)
          const isLoading = loadingIds.has(item.id)
          const rows = lossData.get(item.id) ?? []
          const totalLoss = parseFloat(rows.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4))
          const isEditing = editingId === item.id

          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Item header — always visible, tap to expand */}
              <button onClick={() => toggleItem(item.id)}
                className="w-full text-left p-3 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.item_name}</p>
                    {item.cf_group && <p className="text-xs text-gray-400 mt-0.5">{item.cf_group}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOpen && rows.length > 0 && totalLoss !== 0 && (
                      <span className={`text-xs font-bold ${totalLoss > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {totalLoss > 0 ? '+' : ''}{totalLoss % 1 === 0 ? totalLoss : totalLoss.toFixed(2)}
                      </span>
                    )}
                    <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-x-3 text-xs">
                  <div><p className="text-gray-400">SOH</p><p className="font-bold text-gray-800">{sohFmt(item)}</p></div>
                  <div><p className="text-gray-400">Sell</p><p className="font-medium text-gray-700">{item.selling_rate ? `₵${fmt(item.selling_rate)}` : '—'}</p></div>
                  <div><p className="text-gray-400">Cost</p><p className="font-medium text-gray-700">{item.purchase_rate ? `₵${fmt(item.purchase_rate)}` : '—'}</p></div>
                  <div><p className="text-gray-400">Unit</p><p className="font-medium text-gray-700">{item.unit_name ?? '—'}</p></div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-gray-100 p-3 space-y-3">
                  {/* Edit toggle */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <ItemForm form={editForm} onChange={setEditForm} groups={groups.filter(g => g !== 'All')} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(item)} disabled={saving}
                          className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); startEdit(item) }}
                      className="text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                      Edit Item
                    </button>
                  )}

                  {/* Loss history */}
                  {!isEditing && (
                    isLoading ? (
                      <p className="text-center text-gray-400 py-4 text-xs">Loading history...</p>
                    ) : rows.length === 0 ? (
                      <p className="text-center text-gray-400 py-4 text-xs">No activity found.</p>
                    ) : (
                      <div className="overflow-x-auto -mx-3 px-3">
                        <table className="w-full text-xs min-w-[480px]">
                          <thead>
                            <tr className="text-left text-gray-400 border-b border-gray-100">
                              <th className="pb-1.5 font-medium pr-2">Date</th>
                              <th className="pb-1.5 font-medium text-right pr-2">Count</th>
                              <th className="pb-1.5 font-medium text-right pr-2">-WIC</th>
                              <th className="pb-1.5 font-medium text-right pr-2">-GMC</th>
                              <th className="pb-1.5 font-medium text-right pr-2">+Bills</th>
                              <th className="pb-1.5 font-medium text-right pr-2">Expt</th>
                              <th className="pb-1.5 font-medium text-right">Loss/Gain</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {rows.map((row, i) => (
                              <tr key={i} className={row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}>
                                <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                                <td className="py-1.5 pr-2 text-right font-semibold text-gray-900">{fmtQ(row.qty_counted)}</td>
                                <td className="py-1.5 pr-2 text-right text-gray-600">{fmtQ(row.wic_qty)}</td>
                                <td className="py-1.5 pr-2 text-right text-gray-600">{fmtQ(row.gmc_qty)}</td>
                                <td className="py-1.5 pr-2 text-right text-blue-600">{fmtQ(row.bills_qty)}</td>
                                <td className="py-1.5 pr-2 text-right text-gray-400">{fmtN(row.expected_soh)}</td>
                                <td className="py-1.5 text-right font-semibold">
                                  {row.loss === null ? <span className="text-gray-300">—</span>
                                    : row.loss > 0.001 ? <span className="text-red-600">+{row.loss % 1 === 0 ? row.loss : row.loss.toFixed(2)}</span>
                                    : row.loss < -0.001 ? <span className="text-green-600">{row.loss % 1 === 0 ? row.loss : row.loss.toFixed(2)}</span>
                                    : <span className="text-gray-400">0</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-200">
                              <td colSpan={6} className="pt-2 text-right text-xs font-semibold text-gray-500 pr-2">Total</td>
                              <td className={`pt-2 text-right text-xs font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {totalLoss > 0 ? '+' : ''}{totalLoss % 1 === 0 ? totalLoss : totalLoss.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ItemForm({ form, onChange, groups }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[] }) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
  const labelCls = 'text-xs text-gray-500 font-medium mb-1 block'
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Item Name *</label>
        <input value={form.item_name} onChange={set('item_name')} placeholder="Item name" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Group</label>
        <select value={form.cf_group} onChange={set('cf_group')} className={inputCls}>
          <option value="">— No group —</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Selling Price (GH&#8373;)</label>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={form.selling_rate} onChange={set('selling_rate')} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cost Price (GH&#8373;)</label>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={form.purchase_rate} onChange={set('purchase_rate')} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Units / Pack</label>
          <input type="number" min="0" step="1" inputMode="decimal"
            value={form.units_per_pack} onChange={set('units_per_pack')} placeholder="e.g. 50" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Unit Name</label>
          <input value={form.unit_name} onChange={set('unit_name')} placeholder="e.g. Pieces" className={inputCls} />
        </div>
      </div>
    </div>
  )
}
