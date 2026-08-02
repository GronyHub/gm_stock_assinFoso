'use client'
import { useState, useEffect, useMemo } from 'react'
import AssignWidget from './AssignWidget'
import DynamicTasksSection from './DynamicTasksSection'

type Item = { id: number; calculated_soh: number; selling_rate: string | null; purchase_rate: string | null; product_type: string }

type ItemsFlagType = 'no_group' | 'duplicates' | 'not_in_inventory' | 'neg_soh' | 'no_sp' | 'no_cp'
  | 'unlinked_named' | 'service_violation' | 'alias_prezoho_sales' | 'alias_prezoho_bills' | 'alias_flagged' | 'alias_ambiguous'

type Flags = {
  noGroup?: unknown[]
  duplicates?: unknown[]
  notInInventory?: unknown[]
  unlinkedNamed?: unknown[]
}

// The Items page's own combined 🚩 flags view, the same shape as Sales/
// Counts' own (SalesTab/CountsTab), and the one Items itself had before
// LossTab replaced its old split-pane table -- that swap never carried this
// over, leaving Items' flags reachable only via a "Fix now" deep link from
// elsewhere and with no visible way to add a task on this page at all.
// Self-fetches (flags + losses/summary + aliases/*), same convention every
// other per-page flags panel already uses, so it works standalone here
// rather than depending on LossTab's own data.
export default function ItemsFlagsPanel({ items, onGoToViolation, onClose }: {
  items: Item[]
  onGoToViolation: (key: string) => void
  onClose: () => void
}) {
  const [flags, setFlags] = useState<Flags | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [serviceViolationCount, setServiceViolationCount] = useState(0)
  const [aliasCounts, setAliasCounts] = useState({ prezohoSales: 0, prezohoBills: 0, flagged: 0, ambiguous: 0 })

  useEffect(() => {
    fetch('/api/flags').then(r => r.ok ? r.json() : null).then(d => { if (d) setFlags(d) }).finally(() => setFlagsLoading(false))
    fetch('/api/losses/summary').then(r => r.ok ? r.json() : []).then(d => {
      const list: { product_type: string; cnt: number; gmc: number; bl: number }[] = Array.isArray(d) ? d : []
      setServiceViolationCount(list.filter(r =>
        r.product_type === 'service' && (Number(r.cnt) !== 0 || Number(r.gmc) !== 0 || Number(r.bl) !== 0)
      ).length)
    }).catch(() => {})
    Promise.all([
      fetch('/api/aliases/unresolved').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/unresolved-bills').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/audit').then(r => r.json()).catch(() => []),
      fetch('/api/aliases/ambiguous').then(r => r.json()).catch(() => []),
    ]).then(([salesRows, billRows, auditRows, ambiguousRows]) => {
      const pending = (arr: unknown) => Array.isArray(arr) ? (arr as { confirmed?: boolean }[]).filter(r => !r.confirmed).length : 0
      setAliasCounts({
        prezohoSales: pending(salesRows),
        prezohoBills: pending(billRows),
        flagged: Array.isArray(auditRows) ? auditRows.length : 0,
        ambiguous: Array.isArray(ambiguousRows) ? ambiguousRows.length : 0,
      })
    }).catch(() => {})
  }, [])

  const rows = useMemo(() => {
    const list: { type: ItemsFlagType; count: number; label: string; assignable: boolean; viewable: boolean; loading: boolean }[] = [
      { type: 'no_group', count: flags?.noGroup?.length ?? 0, label: 'item(s) with no group assigned', assignable: true, viewable: true, loading: flagsLoading },
      { type: 'duplicates', count: flags?.duplicates?.length ?? 0, label: 'possible duplicate item pair(s)', assignable: true, viewable: true, loading: flagsLoading },
      { type: 'not_in_inventory', count: flags?.notInInventory?.length ?? 0, label: 'item name(s) not found in inventory', assignable: true, viewable: false, loading: flagsLoading },
      { type: 'neg_soh', count: items.filter(i => Number(i.calculated_soh) < 0 && i.product_type !== 'service').length, label: 'item(s) with negative stock on hand', assignable: false, viewable: true, loading: false },
      { type: 'no_sp', count: items.filter(i => !i.selling_rate || parseFloat(i.selling_rate) === 0).length, label: 'item(s) with no selling price', assignable: false, viewable: true, loading: false },
      { type: 'no_cp', count: items.filter(i => !i.purchase_rate || parseFloat(i.purchase_rate) === 0).length, label: 'item(s) with no cost price', assignable: false, viewable: true, loading: false },
      { type: 'unlinked_named', count: flags?.unlinkedNamed?.length ?? 0, label: 'sale name(s) not linked to their item', assignable: false, viewable: true, loading: flagsLoading },
      { type: 'service_violation', count: serviceViolationCount, label: 'service item(s) with count/GMC/bill activity', assignable: false, viewable: true, loading: flagsLoading },
      { type: 'alias_prezoho_sales', count: aliasCounts.prezohoSales, label: 'Pre-Zoho sales name(s) awaiting alias confirmation', assignable: false, viewable: true, loading: flagsLoading },
      { type: 'alias_prezoho_bills', count: aliasCounts.prezohoBills, label: 'Pre-Zoho bill name(s) awaiting alias confirmation', assignable: false, viewable: true, loading: flagsLoading },
      { type: 'alias_flagged', count: aliasCounts.flagged, label: 'alias(es) flagged as a likely mismatch', assignable: false, viewable: true, loading: flagsLoading },
      { type: 'alias_ambiguous', count: aliasCounts.ambiguous, label: 'alias name(s) mapping to more than one item', assignable: false, viewable: true, loading: flagsLoading },
    ]
    return list
  }, [flags, flagsLoading, items, serviceViolationCount, aliasCounts])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={onClose}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white transition">
          ← Back
        </button>
        <span className="text-[9px] font-semibold text-red-700">🚩 Items Flags</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <DynamicTasksSection scopeKey="Items" />
        {rows.map(r => (
          <div key={r.type} className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-400">
                {r.loading ? 'Loading…' : `${r.count} ${r.label}`}
              </p>
              {r.viewable && (
                <button onClick={() => onGoToViolation(r.type)}
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
