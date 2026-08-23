'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import AliasesTab, { type Tab as AliasTab } from './AliasesTab'
import AssignWidget from './AssignWidget'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
import ItemDetailModal from './ItemDetailModal'

// Each of these 6 checks is its own flag pill on the Items page, and each
// opens AliasesTab straight onto its own dedicated page -- no tab bar to
// jump to a different one from in here, since they check genuinely
// different things (see AliasesTab's own comment for what each one means).
const ALIAS_VIOLATION_TAB: Record<string, AliasTab> = {
  alias_prezoho_sales: 'prezoho-sales',
  alias_prezoho_bills: 'prezoho-bills',
  alias_prezoho_receipts: 'prezoho-receipts',
  alias_flagged: 'flagged',
  alias_ambiguous: 'ambiguous',
  alias_name_conflicts: 'name-conflicts',
}

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
  gmc_type: string
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
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '', product_type: 'goods',
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

function FixRow({ label, sub, children }: { label: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1.5 gap-2">
        <div className="min-w-0 flex-1 truncate">
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

function RecentMergeFix({ r, onUnmerged }: { r: any; onUnmerged: () => void }) {
  const [unmerging, setUnmerging] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(false)

  async function undoMerge() {
    setUnmerging(true)
    try {
      const res = await fetch('/api/items/unmerge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loser_id: r.loser_id, winner_id: r.winner_id }),
      })
      if (res.ok) {
        setConfirmDialog(false)
        onUnmerged()
      }
    } catch (err) {
      console.error('Unmerge failed:', err)
    }
    setUnmerging(false)
  }

  return (
    <FixRow label={`"${r.loser_original_name}" ← "${r.winner_name || 'Unknown'}"`} sub={`Merged ${fmtDate(r.merged_at)} by ${r.merged_by || 'Unknown'}`}>
      {confirmDialog ? (
        <>
          <p className="text-[10px] text-gray-600">Are you sure? This will restore the original item and separate its merged data.</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => setConfirmDialog(false)} disabled={unmerging}
              className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
              Cancel
            </button>
            <button onClick={undoMerge} disabled={unmerging}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
              {unmerging ? 'Unmerging…' : 'Confirm Undo'}
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => setConfirmDialog(true)} disabled={unmerging}
          className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
          Undo Merge
        </button>
      )}
    </FixRow>
  )
}

function DuplicateFix({ r, onFixed, onOpenItem360 }: { r: any; onFixed: (id1: number, id2: number) => void; onOpenItem360?: (itemId: number) => void }) {
  const [saving, setSaving] = useState(false)
  const [merging, setMerging] = useState<number | null>(null)
  const busy = saving || merging !== null

  async function markDifferent() {
    setSaving(true)
    await fetch('/api/flags/dismiss-duplicate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id1: r.id1, id2: r.id2, name1: r.name1, name2: r.name2 }),
    })
    setSaving(false)
    onFixed(r.id1, r.id2)
  }

  async function mergeSame(winnerId: number, loserId: number) {
    setMerging(winnerId)
    await fetch('/api/items/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loser_id: loserId, winner_id: winnerId }),
    })
    setMerging(null)
    onFixed(r.id1, r.id2)
  }

  // Names alone are often too similar to tell apart -- each one opens its
  // own item detail popup so it can actually be identified.
  function nameLink(id: number, name: string) {
    if (!onOpenItem360) return name
    return (
      <button onClick={() => onOpenItem360(id)} title="View item details" className="text-blue-600 hover:underline underline-offset-2">
        {name}
      </button>
    )
  }

  return (
    <FixRow label={nameLink(r.id1, r.name1)} sub={<>vs. {nameLink(r.id2, r.name2)}</>}>
      <p className="text-[10px] text-gray-500">Same item? Pick the name to keep — the other merges into it.</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => mergeSame(r.id1, r.id2)} disabled={busy}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 px-1 transition truncate">
          {merging === r.id1 ? 'Saving…' : `Keep "${r.name1}"`}
        </button>
        <button onClick={() => mergeSame(r.id2, r.id1)} disabled={busy}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 px-1 transition truncate">
          {merging === r.id2 ? 'Saving…' : `Keep "${r.name2}"`}
        </button>
      </div>
      <p className="text-[10px] text-gray-500">Tap <strong>Different</strong> if these are genuinely separate items.</p>
      <button onClick={markDifferent} disabled={busy}
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

function UnlinkedFix({ r, onFixed }: { r: any; onFixed: (item_name: string) => void }) {
  const [saving, setSaving] = useState(false)
  async function linkNow() {
    setSaving(true)
    await fetch('/api/flags/link-unresolved', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: r.item_name, item_id: r.item_id }),
    })
    setSaving(false)
    onFixed(r.item_name)
  }
  return (
    <FixRow label={r.item_name} sub={`${r.line_count} sale${r.line_count !== 1 ? 's' : ''} not linked`}>
      <p className="text-[10px] text-gray-500">These sales match this item by name but were never linked to it — their quantity and revenue are missing from its activity.</p>
      <button onClick={linkNow} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded py-1.5 transition">
        {saving ? 'Linking…' : `Link ${r.line_count} sale${r.line_count !== 1 ? 's' : ''} to this item`}
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
      {/* Goods/Service is what routes an item into the Services section's
          own group tables (see ServicesGroupTable.tsx) vs. tracking stock
          on hand for it -- changeable here rather than fixed forever at
          creation, since a real item sometimes turns out to be the wrong
          one (e.g. a line item added as a good that's actually a labor
          charge). */}
      <select value={form.product_type} onChange={set('product_type')} className={inputCls}>
        <option value="goods">Goods</option>
        <option value="service">Service</option>
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
  violationLabel?: string
  onItemsChanged: (items: Item[]) => void
  showAdd?: boolean
  onCloseAdd?: () => void
  jumpToItemId?: number | null
  onJumpDone?: () => void
  onProductTypeChange?: (type: 'all' | 'goods' | 'services') => void
  onGroupChange?: (group: string | null) => void
  groups?: string[]
}

export default function ItemsTab({ items, group, productType, search, violation, violationLabel, onItemsChanged, showAdd = false, onCloseAdd, jumpToItemId, onJumpDone, onProductTypeChange, onGroupChange, groups = [] }: Props) {
  const [lossMap, setLossMap] = useState<Record<number, DayRow[]>>({})
  const [lossLoading, setLossLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const lawsPanel = useLawsPanel('showItemsFlagsLaws')
  // Item 360 popup -- own local state since ItemsTab is reused in several
  // shells, not just item/page.tsx's, so it can't rely on a parent to own
  // this. Both the "360°" button and DuplicateFix's item-name links (see
  // nameLink) below open the same popup.
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)

  useEffect(() => {
    if (!jumpToItemId) return
    const item = items.find(i => i.id === jumpToItemId)
    if (item) { jumpTo(item); onJumpDone?.() }
  }, [jumpToItemId])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  usePresenceReporter(showAdd ? 'adding an item' : editingId != null ? 'editing an item' : null)
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const rightPaneRef = useRef<HTMLDivElement>(null)
  const scrollingFromClick = useRef(false)
  const selectedIdRef = useRef<number | null>(null)
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [nameRes, setNameRes] = useState<NameRes | null>(null)
  const [nameResLoading, setNameResLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [markingAllDups, setMarkingAllDups] = useState(false)
  const [linkingAllUnlinked, setLinkingAllUnlinked] = useState(false)
  const [lossSummary, setLossSummary] = useState<any[] | null>(null)
  const [lossSummaryLoading, setLossSummaryLoading] = useState(false)
  // One flag icon in the normal toolbar opens a single combined view of all
  // of Items' own violation types. The 3 assignable ones (no_group,
  // duplicates, not_in_inventory) get an AssignWidget; the other 5
  // (neg_soh, no_sp, no_cp, unlinked_named, service_violation) aren't in
  // the assignable/auto-penalty system, so they're informational-only rows
  // with a "View" button into their existing full list. That full list is
  // driven by `violation`, an external prop -- when opened from inside this
  // combined view instead (no external `violation` set), `flagsSummary`
  // stands in for it so the same list views work either way.
  const [flagsSummary, setFlagsSummary] = useState<null
    | 'summary' | 'no_group' | 'duplicates' | 'not_in_inventory'
    | 'neg_soh' | 'no_sp' | 'no_cp' | 'unlinked_named' | 'service_violation'>(null)
  const effectiveViolation = violation ?? (flagsSummary && flagsSummary !== 'summary' ? flagsSummary : null)

  const [recentMerges, setRecentMerges] = useState<any[]>([])
  const [recentMergesLoading, setRecentMergesLoading] = useState(false)

  const needsFlags = flagsSummary !== null || effectiveViolation === 'no_group' || effectiveViolation === 'duplicates' || effectiveViolation === 'unlinked_named'
  const needsNameRes = violation === 'inv_done' || violation === 'inv_todo'
  const needsLossSummary = flagsSummary !== null || effectiveViolation === 'service_violation'

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
        .catch(() => { setFlags({ noGroup: [], duplicates: [], notInInventory: [], unlinkedNamed: [], groupNames: [] }); setFlagsLoading(false) })
    }
  }, [needsFlags, flags, flagsLoading])

  useEffect(() => {
    if (needsLossSummary && !lossSummary && !lossSummaryLoading) {
      setLossSummaryLoading(true)
      fetch('/api/losses/summary')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setLossSummary(Array.isArray(d) ? d : []); setLossSummaryLoading(false) })
        .catch(() => { setLossSummary([]); setLossSummaryLoading(false) })
    }
  }, [needsLossSummary, lossSummary, lossSummaryLoading])

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
        : productType === 'services' ? i.product_type === 'service'
        : i.product_type !== 'service'
      return matchGroup && matchType && i.item_name.toLowerCase().includes(q)
    })
    if (effectiveViolation === 'neg_soh') list = list.filter(i => Number(i.calculated_soh) < 0 && i.product_type !== 'service')
    if (effectiveViolation === 'no_sp') list = list.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0)
    if (effectiveViolation === 'no_cp') list = list.filter(i => (i.product_type !== 'service') && (!i.purchase_rate || parseFloat(i.purchase_rate) === 0))
    return list
  }, [items, group, productType, search, effectiveViolation])

  useEffect(() => {
    const rightPane = rightPaneRef.current
    if (!rightPane) return
    function onScroll() {
      if (scrollingFromClick.current) return
      const paneTop = rightPane!.getBoundingClientRect().top
      const titleBars = rightPane!.querySelectorAll<HTMLElement>('[data-item-id]')
      let best: HTMLElement | null = null
      for (const el of titleBars) {
        const top = el.getBoundingClientRect().top - paneTop
        if (top <= 60) best = el
        else break
      }
      if (!best) return
      const id = Number(best.dataset.itemId)
      if (!id || id === selectedIdRef.current) return
      selectedIdRef.current = id
      setSelectedId(id)
      const leftPane = leftPaneRef.current
      const leftEl = leftPane?.querySelector<HTMLElement>(`[data-left-item="${id}"]`)
      if (leftEl && leftPane) {
        const lPaneTop = leftPane.getBoundingClientRect().top
        const elTop = leftEl.getBoundingClientRect().top
        leftPane.scrollBy({ top: elTop - lPaneTop - leftPane.clientHeight / 2, behavior: 'smooth' })
      }
    }
    rightPane.addEventListener('scroll', onScroll, { passive: true })
    return () => rightPane.removeEventListener('scroll', onScroll)
  }, [filteredItems])

  const serviceViolations = useMemo(() => {
    if (!lossSummary) return []
    return lossSummary.filter((r: any) =>
      r.product_type === 'service' && (Number(r.cnt) !== 0 || Number(r.gmc) !== 0 || Number(r.bl) !== 0)
    )
  }, [lossSummary])

  useEffect(() => {
    if ((effectiveViolation === 'duplicates' || flagsSummary === 'duplicates') && !recentMergesLoading) {
      setRecentMergesLoading(true)
      const itemIds = items.map(i => i.id).join(',')
      fetch(`/api/items/recent-merges?item_ids=${itemIds}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { setRecentMerges(Array.isArray(d.merges) ? d.merges : []); setRecentMergesLoading(false) })
        .catch(() => { setRecentMerges([]); setRecentMergesLoading(false) })
    }
  }, [effectiveViolation, flagsSummary, items, recentMergesLoading])

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
      product_type: item.product_type === 'service' ? 'service' : 'goods',
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
        product_type: editForm.product_type === 'service' ? 'service' : 'goods',
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
        product_type: addForm.product_type === 'service' ? 'service' : 'goods',
      }),
    })
    setAdding(false)
    if (res.ok) {
      const newItem = await res.json()
      onItemsChanged([...items, { ...newItem, calculated_soh: 0 }])
      setAddForm(EMPTY_FORM); onCloseAdd?.()
    }
  }

  // Flat table for simple filter violations
  if (effectiveViolation === 'neg_soh' || effectiveViolation === 'no_sp' || effectiveViolation === 'no_cp') {
    const violatedItems = filteredItems  // already filtered by effectiveViolation in useMemo
    return (
      <div className="flex flex-col h-full min-h-0">
        {!violation && (
          <button onClick={() => setFlagsSummary('summary')}
            className="shrink-0 self-start mx-2 mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
            ← Back to Flags
          </button>
        )}
        <p className="shrink-0 text-[10px] text-gray-400 px-2 py-1">
          {violationLabel ? `${violationLabel} - ` : ''}
          {violatedItems.length} item{violatedItems.length !== 1 ? 's' : ''}
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full table-fixed border-collapse text-[8px]">
            <colgroup>
              <col style={{width:'30%'}} />
              <col style={{width:'15%'}} />
              <col style={{width:'10%'}} />
              <col style={{width:'11%'}} />
              <col style={{width:'11%'}} />
              <col style={{width:'13%'}} />
              <col style={{width:'10%'}} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr className="text-[8px] font-bold text-gray-500">
                <th className="text-left pl-2 py-1">Item</th>
                <th className="text-left py-1">Group</th>
                <th className="text-center py-1">SOH</th>
                <th className="text-center py-1">SP</th>
                <th className="text-center py-1">CP</th>
                <th className="text-center py-1">Units/pack</th>
                <th className="text-center py-1">Edit</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {violatedItems.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">No violations found.</td></tr>
              )}
              {violatedItems.map(item => {
                const soh = Number(item.calculated_soh)
                const isEditing = editingId === item.id
                return (
                  <>
                    <tr key={item.id} className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className="pl-2 py-1 font-semibold text-gray-900 truncate overflow-hidden">{item.item_name}</td>
                      <td className="py-1 text-gray-500 truncate overflow-hidden">{item.cf_group ?? <span className="text-red-400">—</span>}</td>
                      <td className={`text-center py-1 font-bold tabular-nums ${soh <= 0 ? 'text-red-600' : 'text-gray-700'}`}>{soh % 1 === 0 ? soh : soh.toFixed(2)}</td>
                      <td className={`text-center py-1 tabular-nums ${!item.selling_rate || parseFloat(item.selling_rate) === 0 ? 'text-red-500 font-bold' : 'text-blue-600'}`}>
                        {item.selling_rate && parseFloat(item.selling_rate) !== 0 ? parseFloat(item.selling_rate).toFixed(2) : '—'}
                      </td>
                      <td className={`text-center py-1 tabular-nums ${!item.purchase_rate || parseFloat(item.purchase_rate) === 0 ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                        {item.purchase_rate && parseFloat(item.purchase_rate) !== 0 ? parseFloat(item.purchase_rate).toFixed(2) : '—'}
                      </td>
                      <td className="text-center py-1 text-gray-500">
                        {item.units_per_pack ? `${item.units_per_pack}${item.unit_name ? ' ' + item.unit_name : ''}` : '—'}
                      </td>
                      <td className="text-center py-1">
                        {isEditing ? (
                          <div className="flex gap-0.5 justify-center">
                            <button onClick={saveEdit} disabled={saving} className="text-[8px] font-bold text-white bg-green-600 px-1.5 py-0.5 rounded disabled:opacity-50">{saving ? '…' : 'Save'}</button>
                            <button onClick={() => setEditingId(null)} className="text-[8px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(item)} className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">Edit</button>
                        )}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr key={`${item.id}-edit`} className="bg-blue-50">
                        <td colSpan={7} className="px-2 pb-2">
                          <ItemForm form={editForm} onChange={setEditForm} groups={groupNames} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (effectiveViolation === 'service_violation') {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 py-2 h-full">
        {!violation && (
          <button onClick={() => setFlagsSummary('summary')}
            className="mx-2 mb-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
            ← Back to Flags
          </button>
        )}
        <p className="text-[10px] text-gray-400 px-2 mb-1">
          {lossSummaryLoading || !lossSummary
            ? 'Loading…'
            : `${serviceViolations.length} service item${serviceViolations.length !== 1 ? 's' : ''} with count/GMC/bill activity`}
        </p>
        {!lossSummaryLoading && lossSummary && (serviceViolations.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No service items have count/GMC/bill activity.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {serviceViolations.map((r: any) => (
                <div key={r.item_id} className="px-2 py-1.5">
                  <p className="text-[10px] font-semibold text-gray-900 truncate">{r.item_name}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    {Number(r.cnt) !== 0 && <span className="mr-2">CNT: {r.cnt}</span>}
                    {Number(r.gmc) !== 0 && <span className="mr-2">GMC: {r.gmc}</span>}
                    {Number(r.bl) !== 0 && <span>BL: {r.bl}</span>}
                  </p>
                </div>
              ))}
            </div>
        )}
      </div>
    )
  }

  if (effectiveViolation === 'no_group') {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 py-2 h-full">
        {!violation && (
          <button onClick={() => setFlagsSummary('summary')}
            className="mx-2 mb-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
            ← Back to Flags
          </button>
        )}
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

  if (effectiveViolation === 'duplicates') {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 py-2 h-full">
        {!violation && (
          <button onClick={() => setFlagsSummary('summary')}
            className="mx-2 mb-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
            ← Back to Flags
          </button>
        )}
        {!recentMergesLoading && recentMerges.length > 0 && (
          <div className="px-2 mb-2">
            <p className="text-[10px] text-gray-400 mb-1">Recent merges (can be undone):</p>
            <div className="bg-white border border-orange-200 rounded-lg divide-y divide-orange-100 overflow-hidden">
              {recentMerges.map((r: any) => (
                <RecentMergeFix key={r.id} r={r} onUnmerged={() => {
                  setRecentMerges((prev: any[]) => prev.filter(m => m.id !== r.id))
                  setFlags((prev: any) => prev ? { ...prev } : null)
                }} />
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between px-2 mb-1 gap-2">
          <p className="text-[10px] text-gray-400">
            {flagsLoading || !flags ? 'Loading…' : `${activeDups.length} possible duplicate pair${activeDups.length !== 1 ? 's' : ''}`}
          </p>
          {!flagsLoading && flags && activeDups.length > 0 && (
            <button
              onClick={async () => {
                setMarkingAllDups(true)
                await fetch('/api/flags/dismiss-duplicate', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pairs: activeDups.map((r: any) => ({ id1: r.id1, id2: r.id2 })) }),
                })
                setDismissed(prev => {
                  const next = new Set(prev)
                  for (const r of activeDups) next.add(`${Math.min(r.id1, r.id2)}-${Math.max(r.id1, r.id2)}`)
                  return next
                })
                setMarkingAllDups(false)
              }}
              disabled={markingAllDups}
              className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition">
              {markingAllDups ? 'Saving…' : 'Mark All as Different'}
            </button>
          )}
        </div>
        {!flagsLoading && flags && (activeDups.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No duplicate item names found.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {activeDups.map((r: any) => (
                <DuplicateFix key={`${r.id1}-${r.id2}`} r={r} onOpenItem360={setViewingItemId} onFixed={(id1, id2) => {
                  const lo = Math.min(id1, id2), hi = Math.max(id1, id2)
                  setDismissed(prev => new Set(prev).add(`${lo}-${hi}`))
                }} />
              ))}
            </div>
        )}
      </div>
    )
  }

  if (effectiveViolation === 'unlinked_named') {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 py-2 h-full">
        {!violation && (
          <button onClick={() => setFlagsSummary('summary')}
            className="mx-2 mb-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
            ← Back to Flags
          </button>
        )}
        <div className="flex items-center justify-between px-2 mb-1 gap-2">
          <p className="text-[10px] text-gray-400">
            {flagsLoading || !flags ? 'Loading…' : `${flags.unlinkedNamed.length} unlinked item name${flags.unlinkedNamed.length !== 1 ? 's' : ''}`}
          </p>
          {!flagsLoading && flags && flags.unlinkedNamed.length > 0 && (
            <button
              onClick={async () => {
                setLinkingAllUnlinked(true)
                await fetch('/api/flags/link-unresolved', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: flags.unlinkedNamed.map((r: any) => ({ item_name: r.item_name, item_id: r.item_id })) }),
                })
                setFlags((f: any) => f ? { ...f, unlinkedNamed: [] } : f)
                setLinkingAllUnlinked(false)
              }}
              disabled={linkingAllUnlinked}
              className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40 transition">
              {linkingAllUnlinked ? 'Linking…' : 'Link All'}
            </button>
          )}
        </div>
        {!flagsLoading && flags && (flags.unlinkedNamed.length === 0
          ? <p className="py-4 text-center text-gray-400 text-[10px]">No unlinked sales found.</p>
          : <div className="bg-white border-t border-b border-gray-200 divide-y divide-gray-100">
              {flags.unlinkedNamed.map((r: any) => (
                <UnlinkedFix key={r.item_name} r={r} onFixed={(item_name: string) => {
                  setFlags((f: any) => f ? { ...f, unlinkedNamed: f.unlinkedNamed.filter((x: any) => x.item_name !== item_name) } : f)
                }} />
              ))}
            </div>
        )}
      </div>
    )
  }

  const aliasDefaultTab = violation ? ALIAS_VIOLATION_TAB[violation] : undefined
  if (aliasDefaultTab) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <AliasesTab tab={aliasDefaultTab} />
      </div>
    )
  }

  if (lossLoading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  // ── COMBINED FLAGS VIEW ── one flag icon covering all of Items' own
  // violation types together. The 3 assignable ones get an AssignWidget;
  // the other 5 are informational-only with a "View" button into their
  // existing full list (see effectiveViolation above).
  if (flagsSummary === 'summary') {
    type ItemsFlagType = 'no_group' | 'duplicates' | 'not_in_inventory' | 'neg_soh' | 'no_sp' | 'no_cp' | 'unlinked_named' | 'service_violation'
    const rows: { type: ItemsFlagType; count: number; label: string; assignable: boolean; viewable: boolean; loading: boolean }[] = [
      { type: 'no_group', count: flags?.noGroup?.length ?? 0, label: 'item(s) with no group assigned', assignable: true, viewable: true, loading: flagsLoading || !flags },
      { type: 'duplicates', count: flags?.duplicates?.length ?? 0, label: 'possible duplicate item pair(s)', assignable: true, viewable: true, loading: flagsLoading || !flags },
      { type: 'not_in_inventory', count: flags?.notInInventory?.length ?? 0, label: 'item name(s) not found in inventory', assignable: true, viewable: false, loading: flagsLoading || !flags },
      { type: 'neg_soh', count: items.filter(i => Number(i.calculated_soh) < 0 && i.product_type !== 'service').length, label: 'item(s) with negative stock on hand', assignable: false, viewable: true, loading: false },
      { type: 'no_sp', count: items.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0).length, label: 'item(s) with no selling price', assignable: false, viewable: true, loading: false },
      { type: 'no_cp', count: items.filter(i => (i.product_type !== 'service') && (!i.purchase_rate || parseFloat(i.purchase_rate) === 0)).length, label: 'item(s) with no cost price', assignable: false, viewable: true, loading: false },
      { type: 'unlinked_named', count: flags?.unlinkedNamed?.length ?? 0, label: 'sale name(s) not linked to their item', assignable: false, viewable: true, loading: flagsLoading || !flags },
      { type: 'service_violation', count: serviceViolations.length, label: 'service item(s) awaiting GMC data migration', assignable: false, viewable: true, loading: lossSummaryLoading || !lossSummary },
    ]
    const toolsPanelFlags = [
      { key: 'neg_soh', letter: 'N', label: 'Negative Stock Items', count: rows.find(r => r.type === 'neg_soh')?.count ?? 0, description: 'Item(s) with negative stock on hand' },
      { key: 'no_sp', letter: 'S', label: 'Missing Selling Prices', count: rows.find(r => r.type === 'no_sp')?.count ?? 0, description: 'Item(s) with no selling price' },
      { key: 'no_cp', letter: 'C', label: 'Missing Cost Prices', count: rows.find(r => r.type === 'no_cp')?.count ?? 0, description: 'Item(s) with no cost price' },
      { key: 'no_group', letter: 'G', label: 'Item Groups', count: rows.find(r => r.type === 'no_group')?.count ?? 0, description: 'Item(s) with no group assigned' },
      { key: 'duplicates', letter: 'D', label: 'Duplicate Items', count: rows.find(r => r.type === 'duplicates')?.count ?? 0, description: 'Possible duplicate item pair(s)' },
      { key: 'unlinked_named', letter: 'U', label: 'Unlinked Sales', count: rows.find(r => r.type === 'unlinked_named')?.count ?? 0, description: 'Sale name(s) not linked to their item' },
      { key: 'service_violation', letter: 'V', label: 'Service Violations', count: rows.find(r => r.type === 'service_violation')?.count ?? 0, description: 'Service item(s) awaiting GMC data migration' },
    ]
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-2 pt-2 shrink-0 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
          <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
        </div>
        {lawsPanel.show && (
          <div className="px-2 shrink-0">
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <PageLawsList
                scopeKey="Items"
                isItemsLaws={true}
                onChange={lawsPanel.bumpRefresh}
                flags={toolsPanelFlags.map(({ key, label, count, description }) => ({ key, label, count, description, onViewClick: () => setFlagsSummary(key as ItemsFlagType) }))}
                openForm={lawsPanel.openForm}
                setOpenForm={lawsPanel.setOpenForm}
                hideZeroFlags={lawsPanel.hideZeroFlags}
                setHideZeroFlags={lawsPanel.setHideZeroFlags}
                activeFilters={lawsPanel.activeFilters}
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
          <button onClick={() => setFlagsSummary(null)}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
            ← Back
          </button>
          <span className="text-[9px] font-semibold text-red-700">🚩 Items Flags</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {rows.map(r => (
            <div key={r.type} className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-gray-400">
                  {r.loading ? 'Loading…' : `${r.count} ${r.label}`}
                </p>
                {r.viewable && (
                  <button onClick={() => setFlagsSummary(r.type)}
                    className="shrink-0 text-[9px] font-semibold px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                    View
                  </button>
                )}
              </div>
              {r.assignable && <AssignWidget type={r.type} />}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* LEFT: compact item cards */}
      <div ref={leftPaneRef} className="w-1/3 border-r-4 border-blue-600 overflow-y-auto min-h-0">
        <div className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10 space-y-1 px-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-400">{filteredItems.length} items</span>
            <button onClick={() => setFlagsSummary('summary')} title="Item flags -- assign who's responsible for each"
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 transition">
              🚩
            </button>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <select
              value={productType}
              onChange={e => onProductTypeChange?.(e.target.value as 'all' | 'goods' | 'services')}
              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All types</option>
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
            <select
              value={group || ''}
              onChange={e => onGroupChange?.(e.target.value || null)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">All groups</option>
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
        {filteredItems.map(item => {
          const soh = Number(item.calculated_soh)
          return (
            <div key={item.id} data-left-item={item.id} onClick={() => { scrollingFromClick.current = true; jumpTo(item); setTimeout(() => { scrollingFromClick.current = false }, 1000) }}
              className={`cursor-pointer border-b-2 border-black px-2 py-1.5 transition ${selectedId === item.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>
              <p className={`text-[10px] font-semibold truncate leading-tight ${selectedId === item.id ? 'text-white' : 'text-gray-900'}`}>{item.item_name}</p>
              <div className="flex gap-2 text-[9px] mt-0.5">
                <span className={selectedId === item.id ? 'text-blue-100' : 'text-gray-500'}>{item.cf_group || 'No group'}</span>
                <span className={item.product_type === 'service' ? (selectedId === item.id ? 'text-purple-200' : 'text-purple-500') : (selectedId === item.id ? 'text-teal-200' : 'text-teal-600')}>
                  {item.product_type === 'service' ? 'Service' : 'Good'}
                </span>
              </div>
              <div className="flex gap-2 text-[9px] mt-0.5">
                <span className={soh <= 0 ? 'text-red-300 font-bold' : selectedId === item.id ? 'text-blue-100' : 'text-gray-500'}>SOH:{soh % 1 === 0 ? soh : soh.toFixed(2)}</span>
                <span className={selectedId === item.id ? 'text-blue-200' : 'text-blue-500'}>SP:{item.selling_rate ? fmt(item.selling_rate) : '—'}</span>
                <span className={selectedId === item.id ? 'text-green-200' : 'text-green-500'}>CP:{item.purchase_rate ? fmt(item.purchase_rate) : '—'}</span>
              </div>
            </div>
          )
        })}
        {filteredItems.length === 0 && (
          <p className="text-[10px] text-gray-400 text-center py-10">No items</p>
        )}
      </div>

      {/* RIGHT: add form + loss history */}
      <div ref={rightPaneRef} className="w-2/3 overflow-y-auto min-h-0 bg-white pr-2">
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
                  <div data-item-id={item.id} className="flex items-center justify-between px-2 py-1 bg-blue-600 border-b border-blue-700 sticky top-0 z-10">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-white truncate">{item.item_name}</p>
                      <p className="text-[9px] text-blue-200">
                        {item.cf_group ?? 'No group'} · SOH: {Number(item.calculated_soh)} ·{' '}
                        <span className={item.product_type === 'service' ? 'text-purple-200' : 'text-teal-200'}>
                          {item.product_type === 'service' ? 'Service' : 'Good'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setViewingItemId(item.id)}
                        className="text-[9px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded hover:bg-blue-50">
                        360°
                      </button>
                      <button onClick={() => startEdit(item)}
                        className="text-[9px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded hover:bg-blue-50">
                        Edit
                      </button>
                    </div>
                  </div>
                  {lossRows.length === 0 ? (
                    <p className="text-[10px] text-gray-400 text-center py-4">No activity.</p>
                  ) : (
                    <div>
                      <table className="w-full border-collapse text-[8px]">
                        <thead className="sticky top-[28px] z-[9]">
                          <tr className="bg-amber-400">
                            <th className="text-left pr-1 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400">DATE</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">₵</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">L/G</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">CNT</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">WIC</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">GMC</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">SP</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">BL</th>
                            <th className="text-center px-0 py-0.5 font-bold text-gray-800 border-b-2 border-gray-400 border-l-2 border-l-gray-400">EXP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lossRows.map((row, i) => {
                            const sp = item.selling_rate ? parseFloat(String(item.selling_rate)) : null
                            const lossVal = row.loss !== null && sp !== null ? row.loss * sp : null
                            return (
                            <tr key={i} className={`border-b-2 border-gray-300 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                              <td className="pr-1 py-0.5 font-bold text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400">
                                {lossVal === null ? <span className="text-gray-300">—</span>
                                  : lossVal > 0.01 ? <span className="text-red-600">-{fmtN(lossVal)}</span>
                                  : lossVal < -0.01 ? <span className="text-green-600">+{fmtN(Math.abs(lossVal))}</span>
                                  : <span className="text-gray-400">0</span>}
                              </td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400">
                                {row.loss === null ? <span className="text-gray-300">—</span>
                                  : row.loss > 0.001 ? <span className="text-red-600">-{fmtN(row.loss)}</span>
                                  : row.loss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.loss))}</span>
                                  : <span className="text-gray-400">0</span>}
                              </td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-900">{fmtQ(row.qty_counted)}</td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-600">{fmtQ(row.wic_qty)}</td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-600">{fmtQ(row.gmc_qty)}</td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-blue-500">{fmtQ(row.sell_price)}</td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-blue-600">{fmtQ(row.bills_qty)}</td>
                              <td className="px-0 py-0.5 text-center font-bold border-l-2 border-l-gray-400 text-gray-400">{fmtN(row.expected_soh)}</td>
                            </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          {(() => {
                            const sp2 = item.selling_rate ? parseFloat(String(item.selling_rate)) : 0
                            const totalCost = parseFloat(lossRows.reduce((s, r) => s + (r.loss !== null ? r.loss * sp2 : 0), 0).toFixed(2))
                            const cls = `px-0 py-1 text-center font-bold border-l-2 border-l-gray-400 ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`
                            return (
                              <tr className="border-t-2 border-gray-200 bg-gray-50">
                                <td className="pr-1 py-1 font-bold text-gray-500">Total</td>
                                <td className={cls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '₵0'}</td>
                                <td className={cls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
                                <td colSpan={6} />
                              </tr>
                            )
                          })()}
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
      {viewingItemId != null && (
        <ItemDetailModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}
    </div>
  )
}
