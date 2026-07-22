'use client'
import { useState, useEffect } from 'react'
import { ItemDetail, type SummaryRow } from './LossTab'

type SingleItemSummary = SummaryRow & { converts_to_item_name: string | null }

// The same item drop-down Gd/Srv. shows (ItemDetail, reused as-is),
// dropped inline anywhere an item name appears on Gd/Srv. Sld/Gd In --
// self-fetches its own summary row instead of relying on a parent's bulk
// list, and always passes autoEdit={false} with empty edit/merge/alias
// props, which ItemDetail treats as fully read-only (nothing inside it can
// open editing except that prop).
export default function ItemDetailDropdown({ itemId }: { itemId: number }) {
  const [row, setRow] = useState<SingleItemSummary | null>(null)
  const [error, setError] = useState(false)

  // Each instance is mounted fresh with a fixed itemId (opened/closed by the
  // caller conditionally rendering it), so there's no stale-state case to
  // guard against here -- no reset needed before the fetch starts.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/losses/summary/${itemId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!cancelled) setRow(d) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [itemId])

  if (error) return <p className="text-[9px] text-red-400 text-center py-3">Could not load this item.</p>
  if (!row) return <p className="text-[9px] text-gray-400 text-center py-3">Loading…</p>

  return (
    <ItemDetail
      item={row}
      groups={[]}
      allItems={row.converts_to_item_id != null && row.converts_to_item_name
        ? [{ item_id: row.converts_to_item_id, item_name: row.converts_to_item_name }] : []}
      currentAliases={[]}
      currentMatches={[]}
      candidatePool={[]}
      mergePool={[]}
      isOwnerLevelUser={false}
      autoEdit={false}
      onSaved={() => {}}
      onRelationsSaved={() => {}}
      onMerged={() => {}}
    />
  )
}
