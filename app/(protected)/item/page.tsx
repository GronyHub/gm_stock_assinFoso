'use client'
import { useState, useEffect, useRef } from 'react'

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

const EMPTY_FORM = {
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '',
}

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? val : n % 1 === 0 ? n.toString() : n.toFixed(2)
}

export default function ItemPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Edit state
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Add state
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false) })
  }, [])

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]

  const filtered = items.filter(i => {
    const matchGroup = !group || group === 'All'
      ? true
      : (i.cf_group ?? 'Ungrouped') === group
    const matchSearch = i.item_name.toLowerCase().includes(search.toLowerCase())
    return matchGroup && matchSearch
  })

  function startEdit(item: Item) {
    setEditId(item.id)
    setEditForm({
      item_name: item.item_name,
      cf_group: item.cf_group ?? '',
      selling_rate: item.selling_rate ? parseFloat(item.selling_rate).toString() : '',
      purchase_rate: item.purchase_rate ? parseFloat(item.purchase_rate).toString() : '',
      units_per_pack: item.units_per_pack ? parseFloat(item.units_per_pack).toString() : '',
      unit_name: item.unit_name ?? '',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const res = await fetch(`/api/items/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...updated, calculated_soh: i.calculated_soh } : i))
      setEditId(null)
    }
  }

  async function saveAdd() {
    if (!addForm.item_name.trim()) return
    setAdding(true)
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Items</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} of {items.length} items</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditId(null) }}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold
            px-4 py-2 rounded-xl transition">
          + Add Item
        </button>
      </div>

      {/* Search */}
      <input
        ref={searchRef}
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search items…"
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-base
          text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Group filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {groups.map(g => (
          <button
            key={g}
            onClick={() => setGroup(g === 'All' ? null : g)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition
              ${(g === 'All' && !group) || g === group
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
            {g}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-blue-700 rounded-xl p-4 space-y-3">
          <p className="text-white font-semibold">New Item</p>
          <ItemForm form={addForm} onChange={setAddForm} groups={groups.filter(g => g !== 'All')} />
          <div className="flex gap-2">
            <button onClick={saveAdd} disabled={adding || !addForm.item_name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
              {adding ? 'Saving…' : 'Save Item'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-3 rounded-xl bg-gray-800 text-gray-400 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-10">No items found.</p>
        )}
        {filtered.map(item => (
          <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            {editId === item.id ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 font-medium">Editing item</p>
                <ItemForm form={editForm} onChange={setEditForm} groups={groups.filter(g => g !== 'All')} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="px-4 py-3 rounded-xl bg-gray-800 text-gray-400 text-sm font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-medium leading-snug">{item.item_name}</p>
                    {item.cf_group && <p className="text-gray-500 text-xs mt-0.5">{item.cf_group}</p>}
                  </div>
                  <button onClick={() => startEdit(item)}
                    className="shrink-0 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg bg-blue-900/30">
                    Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                  <Stat label="SOH" value={Number(item.calculated_soh) % 1 === 0 ? Number(item.calculated_soh).toString() : Number(item.calculated_soh).toFixed(2)} />
                  <Stat label="Selling Price" value={item.selling_rate ? `GH₵ ${fmt(item.selling_rate)}` : '—'} />
                  <Stat label="Cost Price" value={item.purchase_rate ? `GH₵ ${fmt(item.purchase_rate)}` : '—'} />
                  <Stat label="Unit" value={item.unit_name ?? '—'} />
                  {item.units_per_pack && <Stat label="Units/Pack" value={fmt(item.units_per_pack)} />}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  )
}

function ItemForm({
  form,
  onChange,
  groups,
}: {
  form: typeof EMPTY_FORM
  onChange: (f: typeof EMPTY_FORM) => void
  groups: string[]
}) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-base text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

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
          <label className={labelCls}>Selling Price (GH₵)</label>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={form.selling_rate} onChange={set('selling_rate')} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cost Price (GH₵)</label>
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
