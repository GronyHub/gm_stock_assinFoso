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

function numVal(val: string | null) { return val ? parseFloat(val) || 0 : 0 }

function fmtN(n: number | null) {
  if (n === null) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

function fmtQ(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

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

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? val : n % 1 === 0 ? n.toString() : n.toFixed(2)
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [selected, setSelected] = useState<Item | null>(null)
  const [lossRows, setLossRows] = useState<ComputedRow[]>([])
  const [lossLoading, setLossLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

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

  const fetchLoss = useCallback(async (item: Item) => {
    setLossLoading(true)
    const res = await fetch(`/api/losses/${item.id}`)
    const data: DayRow[] = await res.json()
    setLossRows(computeRows(data))
    setLossLoading(false)
  }, [])

  function selectItem(item: Item) {
    setSelected(item); setEditingId(null); setLossRows([]); fetchLoss(item)
  }

  function startEdit(item: Item) {
    setEditForm({
      item_name: item.item_name,
      cf_group: item.cf_group ?? '',
      selling_rate: item.selling_rate ? parseFloat(item.selling_rate).toString() : '',
      purchase_rate: item.purchase_rate ? parseFloat(item.purchase_rate).toString() : '',
      units_per_pack: item.units_per_pack ? parseFloat(item.units_per_pack).toString() : '',
      unit_name: item.unit_name ?? '',
    })
    setEditingId(item.id)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/items/${selected.id}`, {
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
      setItems(prev => prev.map(i => i.id === selected.id ? { ...i, ...updated, calculated_soh: i.calculated_soh } : i))
      setSelected(s => s ? { ...s, ...updated } : s)
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
      setAddForm(EMPTY_FORM); setShowAdd(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const totalLoss = parseFloat(lossRows.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4))

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${filtered.length} of ${items.length} items…`}
            className="flex-1 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={() => { setShowAdd(v => !v); setSelected(null) }}
            className="shrink-0 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded hover:bg-blue-500">
            + Add
          </button>
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

      <div className="flex flex-1 min-h-0">

        {/* LEFT: items table */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ITEM</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">SOH</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">SP</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">CP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const soh = Number(item.calculated_soh)
                return (
                  <tr key={item.id} onClick={() => selectItem(item)}
                    className={`cursor-pointer border-b border-gray-100 transition ${selected?.id === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-0.5 py-0.5 text-gray-900 truncate max-w-[90px]">{item.item_name}</td>
                    <td className={`px-0.5 py-0.5 text-right font-bold ${soh <= 0 ? 'text-red-500' : 'text-gray-900'}`}>{soh % 1 === 0 ? soh : soh.toFixed(2)}</td>
                    <td className="px-0.5 py-0.5 text-right text-blue-600">{item.selling_rate ? fmt(item.selling_rate) : '—'}</td>
                    <td className="px-0.5 py-0.5 text-right text-green-600">{item.purchase_rate ? fmt(item.purchase_rate) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT: detail / edit / add */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {showAdd ? (
            <div className="p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-600">New Item</p>
              <ItemForm form={addForm} onChange={setAddForm} groups={groups.filter(g => g !== 'All')} />
              <div className="flex gap-1">
                <button onClick={saveAdd} disabled={adding || !addForm.item_name.trim()}
                  className="flex-1 bg-blue-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                  {adding ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
              </div>
            </div>
          ) : !selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select an item</p>
          ) : editingId === selected.id ? (
            <div className="p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-600">Edit Item</p>
              <ItemForm form={editForm} onChange={setEditForm} groups={groups.filter(g => g !== 'All')} />
              <div className="flex gap-1">
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingId(null)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-900 truncate">{selected.item_name}</p>
                  <p className="text-[9px] text-gray-400">{selected.cf_group ?? 'No group'} · SOH: {Number(selected.calculated_soh)}</p>
                </div>
                <button onClick={() => startEdit(selected)}
                  className="shrink-0 text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 ml-1">
                  Edit
                </button>
              </div>

              {/* Loss history table */}
              {lossLoading ? (
                <p className="text-[10px] text-gray-400 text-center py-6">Loading…</p>
              ) : lossRows.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-6">No activity.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[9px] min-w-[280px]">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr>
                        <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">DATE</th>
                        <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">CNT</th>
                        <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">-WIC</th>
                        <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">-GMC</th>
                        <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">+BL</th>
                        <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">EXP</th>
                        <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">L/G</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lossRows.map((row, i) => (
                        <tr key={i} className={`border-b border-gray-100 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                          <td className="px-0.5 py-0.5 text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                          <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">{fmtQ(row.qty_counted)}</td>
                          <td className="px-0.5 py-0.5 text-right text-gray-600">{fmtQ(row.wic_qty)}</td>
                          <td className="px-0.5 py-0.5 text-right text-gray-600">{fmtQ(row.gmc_qty)}</td>
                          <td className="px-0.5 py-0.5 text-right text-blue-600">{fmtQ(row.bills_qty)}</td>
                          <td className="px-0.5 py-0.5 text-right text-gray-400">{fmtN(row.expected_soh)}</td>
                          <td className="px-0.5 py-0.5 text-right font-semibold">
                            {row.loss === null ? <span className="text-gray-300">—</span>
                              : row.loss > 0.001 ? <span className="text-red-600">+{fmtN(row.loss)}</span>
                              : row.loss < -0.001 ? <span className="text-green-600">{fmtN(row.loss)}</span>
                              : <span className="text-gray-400">0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={6} className="px-0.5 py-1 text-right font-bold text-gray-500">Total L/G</td>
                        <td className={`px-0.5 py-1 text-right font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {totalLoss > 0 ? '+' : ''}{fmtN(totalLoss)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemForm({ form, onChange, groups }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[] }) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  const cls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-[9px] text-gray-400 mb-0.5">Name *</p>
        <input value={form.item_name} onChange={set('item_name')} placeholder="Item name" className={cls} />
      </div>
      <div>
        <p className="text-[9px] text-gray-400 mb-0.5">Group</p>
        <select value={form.cf_group} onChange={set('cf_group')} className={cls}>
          <option value="">— No group —</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div>
          <p className="text-[9px] text-gray-400 mb-0.5">Sell (₵)</p>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={form.selling_rate} onChange={set('selling_rate')} placeholder="0.00" className={cls} />
        </div>
        <div>
          <p className="text-[9px] text-gray-400 mb-0.5">Cost (₵)</p>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={form.purchase_rate} onChange={set('purchase_rate')} placeholder="0.00" className={cls} />
        </div>
        <div>
          <p className="text-[9px] text-gray-400 mb-0.5">Units/Pack</p>
          <input type="number" min="0" step="1" inputMode="decimal"
            value={form.units_per_pack} onChange={set('units_per_pack')} placeholder="e.g. 50" className={cls} />
        </div>
        <div>
          <p className="text-[9px] text-gray-400 mb-0.5">Unit Name</p>
          <input value={form.unit_name} onChange={set('unit_name')} placeholder="e.g. Pcs" className={cls} />
        </div>
      </div>
    </div>
  )
}
