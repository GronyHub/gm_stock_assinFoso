'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import AliasesTab from './AliasesTab'

type Item = {
  id: number
  item_name: string
  cf_group: string | null
  selling_rate: string | null
  purchase_rate: string | null
  units_per_pack: string | null
  unit_name: string | null
  product_type: string
  calculated_soh: number
}

type DayRow = {
  item_id: number
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  sell_price: string | null
  cost_price: string | null
}

type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

const EMPTY_FORM = {
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '',
}

type NameRes = {
  unmatched: { name: string; line_count: number }[]
  matched: { name: string; canonical_name: string; line_count: number }[]
  items: { id: number; canonical_name: string }[]
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

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? val : n % 1 === 0 ? n.toString() : n.toFixed(2)
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

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[9px] font-bold px-1 py-0.5 rounded-full">{n}</span>
}

function FixRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1.5 gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-gray-900 font-semibold">{label}</span>
          {sub && <span className="ml-2 text-[9px] text-gray-400">{sub}</span>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
          {open ? 'Close' : 'Fix'}
        </button>
      </div>
      {open && <div className="px-2 pb-2 border-t border-gray-50 space-y-1.5 pt-1.5">{children}</div>}
    </div>
  )
}

function DuplicateFix({ r, onFixed }: { r: any; onFixed: (id1: number, id2: number) => void }) {
  const [saving, setSaving] = useState(false)
  async function markDifferent() {
    setSaving(true)
    await fetch('/api/flags/dismiss-duplicate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id1: r.id1, id2: r.id2, name1: r.name1, name2: r.name2 }),
    })
    setSaving(false)
    onFixed(r.id1, r.id2)
  }
  return (
    <FixRow label={r.name1} sub={`vs. ${r.name2}`}>
      <p className="text-[10px] text-gray-500">Tap <strong>Different</strong> if these are genuinely separate items.</p>
      <button onClick={markDifferent} disabled={saving}
        className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
        {saving ? 'Saving…' : 'Different — Not a Duplicate'}
      </button>
    </FixRow>
  )
}

function NoGroupFix({ r, groupNames, onFixed }: { r: any; groupNames: string[]; onFixed: (id: number) => void }) {
  const [selected, setSelected] = useState('')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const group = selected === '__custom__' ? custom.trim() : selected
  async function save() {
    if (!group) return
    setSaving(true)
    await fetch(`/api/items/${r.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cf_group: group }),
    })
    setSaving(false)
    onFixed(r.id)
  }
  return (
    <FixRow label={r.item_name} sub={`Status: ${r.status}`}>
      <select value={selected} onChange={e => setSelected(e.target.value)} className={inputCls}>
        <option value="">— Select a group —</option>
        {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
        <option value="__custom__">+ New group name…</option>
      </select>
      {selected === '__custom__' && (
        <input placeholder="Type new group name" value={custom}
          onChange={e => setCustom(e.target.value)} className={inputCls} />
      )}
      <button onClick={save} disabled={!group || saving}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
        {saving ? 'Saving…' : 'Assign Group'}
      </button>
    </FixRow>
  )
}

function NameResolveRow({ name, count, items, onResolved }: {
  name: string; count: number; items: { id: number; canonical_name: string }[]
  onResolved: (name: string, canonical: string, itemId: number) => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ id: number; canonical_name: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = search.length >= 1
    ? items.filter(i => i.canonical_name.toLowerCase().includes(search.toLowerCase())).slice(0, 25)
    : []

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  async function save() {
    if (!selected) return
    setSaving(true)
    await fetch('/api/flags/name-resolution', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_name: name, item_id: selected.id, canonical_name: selected.canonical_name }),
    })
    setSaving(false)
    onResolved(name, selected.canonical_name, selected.id)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5 mx-2 mb-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium text-gray-900 leading-snug">{name}</p>
        <span className="shrink-0 text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div ref={ref} className="relative">
        <input value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search inventory to match…"
          className={inputCls} />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
            {filtered.map(item => (
              <button key={item.id} onMouseDown={e => e.preventDefault()}
                onClick={() => { setSelected(item); setSearch(item.canonical_name); setOpen(false) }}
                className="w-full text-left px-2 py-1.5 text-[10px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                {item.canonical_name}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <button onClick={save} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
          {saving ? 'Saving…' : `Map → ${selected.canonical_name}`}
        </button>
      )}
    </div>
  )
}

function ItemForm({ form, onChange, groups }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void; groups: string[] }) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  return (
    <div className="space-y-1">
      <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={inputCls} />
      <select value={form.cf_group} onChange={set('cf_group')} className={inputCls}>
        <option value="">— No group —</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Selling rate" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={inputCls} />
        <input placeholder="Cost rate" type="number" value={form.purchase_rate} onChange={set('purchase_rate')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={inputCls} />
        <input placeholder="Unit name" value={form.unit_name} onChange={set('unit_name')} className={inputCls} />
      </div>
    </div>
  )
}

type Props = {
  items: Item[]
  group: string | null
  productType: 'all' | 'goods' | 'services'
  search: string
  violation: string | null
  onItemsChanged: (items: Item[]) => void
  showAdd?: boolean
  onCloseAdd?: () => void
}

export default function ItemsTab({ items, group, productType, search, violation, onItemsChanged, showAdd = false, onCloseAdd }: Props) {
  const [lossMap, setLossMap] = useState<Record<number, DayRow[]>>({})
  const [lossLoading, setLossLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  usePresenceReporter(showAdd ? 'adding an item' : editingId != null ? 'editing an item' : null)
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [nameRes, setNameRes] = useState<NameRes | null>(null)
  const [nameResLoading, setNameResLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const needsFlags = violation === 'no_group' || violation === 'duplicates'
  const needsNameRes = violation === 'inv_done' || violation === 'inv_todo'

  useEffect(() => {
    fetch('/api/losses/all').then(r => r.json()).then(lossData => {
      const map: Record<number, DayRow[]> = {}
      if (Array.isArray(lossData)) {
        for (const row of lossData) {
          if (!map[row.item_id]) map[row.item_id] = []
          map[row.item_id].push(row)
        }
      }
      setLossMap(map)
      setLossLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch('/api/flags/dismiss-duplicate')
      .then(r => r.json())
      .then((rows: { item_id1: number; item_id2: number }[]) => {
        if (Array.isArray(rows)) setDismissed(new Set(rows.map(r => `${r.item_id1}-${r.item_id2}`)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (needsFlags && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => { setFlags({ noGroup: [], duplicates: [], notInInventory: [], groupNames: [] }); setFlagsLoading(false) })
    }
  }, [needsFlags, flags, flagsLoading])

  useEffect(() => {
    if (needsNameRes && !nameRes && !nameResLoading) {
      setNameResLoading(true)
      fetch('/api/flags/name-resolution')
        .then(r => r.json())
        .then(d => { setNameRes(d); setNameResLoading(false) })
        .catch(() => { setNameRes({ unmatched: [], matched: [], items: [] }); setNameResLoading(false) })
    }
  }, [needsNameRes, nameRes, nameResLoading])

  const groupNames = Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase()
    let list = items.filter(i => {
      const matchGroup = !group || group === 'All' ? true : (i.cf_group ?? 'Ungrouped') === group
      const matchType = productType === 'all' ? true
        : productType === 'services' ? i.product_type === 'services'
        : i.product_type !== 'services'
      return matchGroup && matchType && i.item_name.toLowerCase().includes(q)
    })
    if (violation === 'neg_soh') list = list.filter(i => Number(i.calculated_soh) <= 0)
    if (violation === 'no_sp') list = list.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0)
    if (violation === 'no_cp') list = list.filter(i => !i.purchase_rate || parseFloat(i.purchase_rate) === 0)
    return list
  }, [items, group, productType, search, violation])

  const activeDups = flags ? flags.duplicates.filter((r: any) => {
    const lo = Math.min(r.id1, r.id2), hi = Math.max(r.id1, r.id2)
    return !dismissed.has(`${lo}-${hi}`)
  }) : []

  function jumpTo(item: Item) {
    setSelectedId(item.id)
    document.getElementById(`item-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    if (editingId == null) return
    setSaving(true)
    const res = await fetch(`/api/items/${editingId}`, {
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
      onItemsChanged(items.map(i => i.id === editingId ? { ...i, ...updated, calculated_soh: i.calculated_soh } : i))
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
      onItemsChanged([...items, { ...newItem, calculated_soh: 0 }])
      setAddForm(EMPTY_FORM); onCloseAdd?.()
    }
  }

  // Flags panels (violation = no_group | duplicates | inv_todo | inv_done)
  if (violation === 'no_group') {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 py-2 h-full">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {flagsLoading || !flags ? 'Loading…' : `${flags.noGroup.length} item${flags.noGroup.length !== 1 ? 's' : ''} with no group`}
        </p>
        {!flagsLoading && flags && (flags.noGroup.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">All items have a group.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {flags.noGroup.map((r: any) => (
                <NoGroupFix key={r.id} r={r} groupNames={flags.groupNames ?? []} onFixed={id =>
                  setFlags((f: any) => f ? { ...f, noGroup: f.noGroup.filter((x: any) => x.id !== id) } : f)
                } />
              ))}
            </div>
        )}
      </div>
    )
  }

  if (violation === 'duplicates') {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 py-2 h-full">
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {flagsLoading || !flags ? 'Loading…' : `${activeDups.length} possible duplicate pair${activeDups.length !== 1 ? 's' : ''}`}
        </p>
        {!flagsLoading && flags && (activeDups.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No duplicate item names found.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {activeDups.map((r: any) => (
                <DuplicateFix key={`${r.id1}-${r.id2}`} r={r} onFixed={(id1, id2) => {
                  const lo = Math.min(id1, id2), hi = Math.max(id1, id2)
                  setDismissed(prev => new Set(prev).add(`${lo}-${hi}`))
                }} />
              ))}
            </div>
        )}
      </div>
    )
  }

  if (violation === 'aliases') {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <AliasesTab />
      </div>
    )
  }

  if (lossLoading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex h-full min-h-0">
      {/* LEFT: compact item cards */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto min-h-0">
        <div className="px-2 py-1 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
          <span className="text-[9px] text-gray-400">{filteredItems.length} items</span>
        </div>
        {filteredItems.map(item => {
          const soh = Number(item.calculated_soh)
          return (
            <div key={item.id} onClick={() => jumpTo(item)}
              className={`cursor-pointer border-b border-gray-100 px-2 py-1.5 transition ${selectedId === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <p className="text-[10px] text-gray-900 font-semibold truncate leading-tight">{item.item_name}</p>
              <div className="flex gap-2 text-[9px] mt-0.5">
                <span className={soh <= 0 ? 'text-red-500 font-bold' : 'text-gray-500'}>SOH:{soh % 1 === 0 ? soh : soh.toFixed(2)}</span>
                <span className="text-blue-500">SP:{item.selling_rate ? fmt(item.selling_rate) : '—'}</span>
                <span className="text-green-500">CP:{item.purchase_rate ? fmt(item.purchase_rate) : '—'}</span>
              </div>
            </div>
          )
        })}
        {filteredItems.length === 0 && (
          <p className="text-[10px] text-gray-400 text-center py-10">No items</p>
        )}
      </div>

      {/* RIGHT: add form + loss history */}
      <div className="w-2/3 overflow-y-auto min-h-0 bg-white">
        {showAdd && (
          <div className="p-2 space-y-2 border-b border-gray-200">
            <p className="text-[10px] font-bold text-gray-600">New Item</p>
            <ItemForm form={addForm} onChange={setAddForm} groups={groupNames} />
            <div className="flex gap-1">
              <button onClick={saveAdd} disabled={adding || !addForm.item_name.trim()}
                className="flex-1 bg-blue-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                {adding ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => onCloseAdd?.()}
                className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
            </div>
          </div>
        )}
        {filteredItems.map(item => {
          const lossRows = computeRows(lossMap[item.id] ?? [])
          const totalLoss = parseFloat(lossRows.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4))
          return (
            <div key={item.id} id={`item-${item.id}`}
              className={`border-b border-gray-200 transition ${selectedId === item.id ? 'bg-blue-50/40' : ''}`}>
              {editingId === item.id ? (
                <div className="p-2 space-y-2">
                  <p className="text-[10px] font-bold text-gray-600">Edit Item</p>
                  <ItemForm form={editForm} onChange={setEditForm} groups={groupNames} />
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
                  <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-gray-900 truncate">{item.item_name}</p>
                      <p className="text-[9px] text-gray-400">{item.cf_group ?? 'No group'} · SOH: {Number(item.calculated_soh)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={`/stock/${item.id}`}
                        className="text-[9px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded hover:bg-purple-100">
                        360°
                      </a>
                      <button onClick={() => startEdit(item)}
                        className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                        Edit
                      </button>
                    </div>
                  </div>
                  {lossRows.length === 0 ? (
                    <p className="text-[10px] text-gray-400 text-center py-4">No activity.</p>
                  ) : (
                    <div>
                      <table className="w-full border-collapse text-[8px]">
                        <thead>
                          <tr>
                            <th className="text-left px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">DATE</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">CNT</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">-WIC</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">-GMC</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">SP</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">+BL</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">EXP</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">L/G</th>
                            <th className="text-right px-0.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">₵</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lossRows.map((row, i) => {
                            const sp = item.selling_rate ? parseFloat(String(item.selling_rate)) : null
                            const lossVal = row.loss !== null && sp !== null ? row.loss * sp : null
                            return (
                            <tr key={i} className={`border-b border-gray-100 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                              <td className="px-0.5 py-0.5 text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                              <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">{fmtQ(row.qty_counted)}</td>
                              <td className="px-0.5 py-0.5 text-right text-gray-600">{fmtQ(row.wic_qty)}</td>
                              <td className="px-0.5 py-0.5 text-right text-gray-600">{fmtQ(row.gmc_qty)}</td>
                              <td className="px-0.5 py-0.5 text-right text-blue-500">{fmtQ(row.sell_price)}</td>
                              <td className="px-0.5 py-0.5 text-right text-blue-600">{fmtQ(row.bills_qty)}</td>
                              <td className="px-0.5 py-0.5 text-right text-gray-400">{fmtN(row.expected_soh)}</td>
                              <td className="px-0.5 py-0.5 text-right font-semibold">
                                {row.loss === null ? <span className="text-gray-300">—</span>
                                  : row.loss > 0.001 ? <span className="text-red-600">+{fmtN(row.loss)}</span>
                                  : row.loss < -0.001 ? <span className="text-green-600">{fmtN(row.loss)}</span>
                                  : <span className="text-gray-400">0</span>}
                              </td>
                              <td className="px-0.5 py-0.5 text-right font-semibold">
                                {lossVal === null ? <span className="text-gray-300">—</span>
                                  : lossVal > 0.01 ? <span className="text-red-600">{fmtN(lossVal)}</span>
                                  : lossVal < -0.01 ? <span className="text-green-600">{fmtN(lossVal)}</span>
                                  : <span className="text-gray-400">0</span>}
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50">
                            <td colSpan={7} className="px-0.5 py-1 text-right font-bold text-gray-500">Total L/G</td>
                            <td className={`px-0.5 py-1 text-right font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {totalLoss > 0 ? '+' : ''}{fmtN(totalLoss)}
                            </td>
                            <td className={`px-0.5 py-1 text-right font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {(() => {
                                const sp2 = item.selling_rate ? parseFloat(String(item.selling_rate)) : 0
                                const totalCost = parseFloat(lossRows.reduce((s, r) => s + (r.loss !== null ? r.loss * sp2 : 0), 0).toFixed(2))
                                return totalCost > 0 ? fmtN(totalCost) : totalCost < 0 ? fmtN(totalCost) : '0'
                              })()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
