'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
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
  item_id: number
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

const TABS = ['List', 'No Group', 'Duplicates', 'Not in Inv.', 'Inv. Done', 'Inv. Todo'] as const
type Tab = typeof TABS[number]

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

// Duplicates — mark as different items
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
      <p className="text-[10px] text-gray-500">Tap <strong>Different</strong> if these are genuinely separate items. To remove a real duplicate, delete it from the item list.</p>
      <button onClick={markDifferent} disabled={saving}
        className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
        {saving ? 'Saving…' : 'Different — Not a Duplicate'}
      </button>
    </FixRow>
  )
}

// Not in Inv. — jump to Inv. Todo tab
function NotInInvRow({ r, onSwitchTab }: { r: any; onSwitchTab: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-gray-900 font-semibold truncate block">{r.item_name}</span>
        <span className="text-[9px] text-gray-400">{r.source}</span>
      </div>
      <button onClick={onSwitchTab}
        className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
        Resolve →
      </button>
    </div>
  )
}

// No Group — assign a group from populated dropdown + free text fallback
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

type InvItem = { id: number; canonical_name: string }
type NameRes = {
  unmatched: { name: string; line_count: number }[]
  matched: { name: string; canonical_name: string; line_count: number }[]
  items: InvItem[]
}

function NameResolveRow({
  name, count, items, onResolved,
}: {
  name: string; count: number; items: InvItem[]
  onResolved: (name: string, canonical: string, itemId: number) => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InvItem | null>(null)
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
        <span className="shrink-0 text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{count} line{count !== 1 ? 's' : ''}</span>
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
        {open && search.length >= 1 && filtered.length === 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1.5 text-[10px] text-gray-400">
            No match found
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

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lossMap, setLossMap] = useState<Record<number, DayRow[]>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  const [tab, setTab] = useState<Tab>('List')
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [nameRes, setNameRes] = useState<NameRes | null>(null)
  const [nameResLoading, setNameResLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/flags/dismiss-duplicate')
      .then(r => r.json())
      .then((rows: { item_id1: number; item_id2: number }[]) => {
        if (Array.isArray(rows)) setDismissed(new Set(rows.map(r => `${r.item_id1}-${r.item_id2}`)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const flagTabs: Tab[] = ['No Group', 'Duplicates', 'Not in Inv.']
    if (flagTabs.includes(tab) && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => {
          setFlags({ noGroup: [], duplicates: [], notInInventory: [], groupNames: [] })
          setFlagsLoading(false)
        })
    }
  }, [tab, flags, flagsLoading])

  useEffect(() => {
    const nameResTabs: Tab[] = ['Inv. Done', 'Inv. Todo']
    if (nameResTabs.includes(tab) && !nameRes && !nameResLoading) {
      setNameResLoading(true)
      fetch('/api/flags/name-resolution')
        .then(r => r.json())
        .then(d => { setNameRes(d); setNameResLoading(false) })
        .catch(() => { setNameRes({ unmatched: [], matched: [], items: [] }); setNameResLoading(false) })
    }
  }, [tab, nameRes, nameResLoading])

  function dismissDuplicate(id1: number, id2: number) {
    const lo = Math.min(id1, id2), hi = Math.max(id1, id2)
    setDismissed(prev => new Set(prev).add(`${lo}-${hi}`))
  }

  function handleResolved(rawName: string, canonical: string, itemId: number) {
    setNameRes(prev => {
      if (!prev) return prev
      const row = prev.unmatched.find(u => u.name === rawName)
      return {
        ...prev,
        unmatched: prev.unmatched.filter(u => u.name !== rawName),
        matched: [{ name: rawName, canonical_name: canonical, line_count: row?.line_count ?? 1 }, ...prev.matched],
      }
    })
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/items').then(r => r.json()),
      fetch('/api/losses/all').then(r => r.json()),
    ]).then(([itemsData, lossData]) => {
      setItems(itemsData)
      const map: Record<number, DayRow[]> = {}
      if (Array.isArray(lossData)) {
        for (const row of lossData) {
          if (!map[row.item_id]) map[row.item_id] = []
          map[row.item_id].push(row)
        }
      }
      setLossMap(map)
      setLoading(false)
    })
  }, [])

  const groups = ['All', ...Array.from(new Set(items.map(i => i.cf_group ?? 'Ungrouped'))).sort()]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i => {
      const matchGroup = !group || group === 'All' ? true : (i.cf_group ?? 'Ungrouped') === group
      return matchGroup && i.item_name.toLowerCase().includes(q)
    })
  }, [items, search, group])

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
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, ...updated, calculated_soh: i.calculated_soh } : i))
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

  const activeDups = flags ? flags.duplicates.filter((r: any) => {
    const lo = Math.min(r.id1, r.id2), hi = Math.max(r.id1, r.id2)
    return !dismissed.has(`${lo}-${hi}`)
  }) : []

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${filtered.length} of ${items.length}…`}
            className="w-24 flex-1 min-w-0 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex gap-1 overflow-x-auto shrink-0 max-w-[60%]">
            {TABS.map(t => {
              const cnt = t === 'No Group' ? (flags?.noGroup.length ?? 0)
                : t === 'Duplicates' ? activeDups.length
                : t === 'Not in Inv.' ? (flags?.notInInventory.length ?? 0)
                : t === 'Inv. Done' ? (nameRes?.matched.length ?? 0)
                : t === 'Inv. Todo' ? (nameRes?.unmatched.length ?? 0)
                : 0
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`shrink-0 text-[9px] font-semibold px-1.5 py-1 rounded transition whitespace-nowrap
                    ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t}<Badge n={cnt} />
                </button>
              )
            })}
          </div>
        </div>
        {/* Group chips + Add — only in List tab */}
        {tab === 'List' && (
          <div className="flex items-center gap-1 px-2 pb-1.5 overflow-x-auto">
            {groups.map(g => (
              <button key={g} onClick={() => setGroup(g === 'All' ? null : g)}
                className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition
                  ${(g === 'All' && !group) || g === group ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {g}
              </button>
            ))}
            <button onClick={() => { setShowAdd(v => !v); setSelectedId(null) }}
              className="shrink-0 ml-auto bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded hover:bg-blue-500">
              + Add
            </button>
          </div>
        )}
      </div>

      {tab === 'List' && (
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
                  <tr key={item.id} onClick={() => jumpTo(item)}
                    className={`cursor-pointer border-b border-gray-100 transition ${selectedId === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
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

        {/* RIGHT: add / every item's loss history, stacked continuously */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {showAdd && (
            <div className="p-2 space-y-2 border-b border-gray-200">
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
          )}
          {filtered.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-10">No items found</p>
          ) : (
            filtered.map(item => {
              const lossRows = computeRows(lossMap[item.id] ?? [])
              const totalLoss = parseFloat(lossRows.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4))
              return (
                <div key={item.id} id={`item-${item.id}`}
                  className={`border-b border-gray-200 transition ${selectedId === item.id ? 'bg-blue-50/40' : ''}`}>
                  {editingId === item.id ? (
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
                      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-gray-900 truncate">{item.item_name}</p>
                          <p className="text-[9px] text-gray-400">{item.cf_group ?? 'No group'} · SOH: {Number(item.calculated_soh)}</p>
                        </div>
                        <button onClick={() => startEdit(item)}
                          className="shrink-0 text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 ml-1">
                          Edit
                        </button>
                      </div>

                      {/* Loss history table */}
                      {lossRows.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-4">No activity.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-[9px] min-w-[280px]">
                            <thead>
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
              )
            })
          )}
        </div>
      </div>
      )}

      {tab === 'No Group' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {flagsLoading || !flags ? 'Loading…' : `${flags.noGroup.length} item${flags.noGroup.length !== 1 ? 's' : ''} with no group assigned`}
          </p>
          {flagsLoading || !flags ? null : flags.noGroup.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">All items have a group assigned.</p>
            : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
                {flags.noGroup.map((r: any) => (
                  <NoGroupFix key={r.id} r={r} groupNames={flags.groupNames ?? []} onFixed={id =>
                    setFlags((f: any) => f ? { ...f, noGroup: f.noGroup.filter((x: any) => x.id !== id) } : f)
                  } />
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'Duplicates' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {flagsLoading || !flags ? 'Loading…' : `${activeDups.length} possible duplicate pair${activeDups.length !== 1 ? 's' : ''} (similarity > 65%)`}
          </p>
          {flagsLoading || !flags ? null : activeDups.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">No duplicate or similar item names found.</p>
            : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
                {activeDups.map((r: any) => (
                  <DuplicateFix key={`${r.id1}-${r.id2}`} r={r} onFixed={(id1, id2) => dismissDuplicate(id1, id2)} />
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'Not in Inv.' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {flagsLoading || !flags ? 'Loading…' : `${flags.notInInventory.length} item name${flags.notInInventory.length !== 1 ? 's' : ''} not found in inventory`}
          </p>
          {flagsLoading || !flags ? null : flags.notInInventory.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">All items in receipts and counts are in inventory.</p>
            : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
                {flags.notInInventory.map((r: any, i: number) => (
                  <NotInInvRow key={i} r={r} onSwitchTab={() => setTab('Inv. Todo')} />
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'Inv. Todo' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {nameResLoading || !nameRes ? 'Loading…' : `${nameRes.unmatched.length} receipt line name${nameRes.unmatched.length !== 1 ? 's' : ''} not matched`}
          </p>
          {nameResLoading || !nameRes ? null : nameRes.unmatched.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">All names matched.</p>
            : nameRes.unmatched.map(u => (
                <NameResolveRow key={u.name} name={u.name} count={u.line_count}
                  items={nameRes.items} onResolved={handleResolved} />
              ))
          }
        </div>
      )}

      {tab === 'Inv. Done' && (
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <p className="text-[10px] text-gray-400 px-2 mb-1">
            {nameResLoading || !nameRes ? 'Loading…' : `${nameRes.matched.length} receipt line name${nameRes.matched.length !== 1 ? 's' : ''} matched to inventory`}
          </p>
          {nameResLoading || !nameRes ? null : nameRes.matched.length === 0
            ? <p className="py-4 text-center text-gray-400 text-[10px]">No matched names yet.</p>
            : <table className="w-full border-collapse text-[10px]">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    <th className="text-left px-2 py-1 font-semibold text-gray-500 border-b border-gray-200">Receipt Name</th>
                    <th className="text-left px-2 py-1 font-semibold text-gray-500 border-b border-gray-200">Matched To</th>
                    <th className="text-left px-2 py-1 font-semibold text-gray-500 border-b border-gray-200">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nameRes.matched.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 text-gray-800">{r.name}</td>
                      <td className="px-2 py-1 text-blue-700 font-medium">{r.canonical_name}</td>
                      <td className="px-2 py-1 text-gray-500">{r.line_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}
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
