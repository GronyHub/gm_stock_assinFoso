'use client'
import ItemsTab from './ItemsTab'
import SalesTab from './SalesTab'
import CountsTab from './CountsTab'
import LossFeedTab from './LossFeedTab'
import CABTab from './CABTab'
import { useColumnPrefs } from './columnPrefs'
import { SALES_COLUMNS, type ColKey as SalesColKey } from './salesTabColumns'

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

// The views a self-created task can be pinned to -- unlike
// ViolationFixPanel's types, none of these filter to a specific violation;
// they're just the plain tab a task's own "Fix" button should drop open.
export const TASK_VIEWS: { value: string; label: string }[] = [
  { value: '', label: 'No view' },
  { value: 'items', label: 'Items' },
  { value: 'sales', label: 'Sales' },
  { value: 'counts', label: 'Counts' },
  { value: 'loss_feed', label: 'Loss Feed' },
  { value: 'cab', label: 'CAB' },
]

type Props = {
  view: string
  items: Item[]
  onItemsChanged: (items: Item[]) => void
}

export default function TaskViewPanel({ view, items, onItemsChanged }: Props) {
  // Called unconditionally (hooks can't be conditional) even though only
  // the 'sales' branch below actually uses it -- SalesTab's colPrefs prop
  // is required now that item/page.tsx's own Sales tab also owns a
  // useColumnPrefs() instance to render the Columns picker in its own
  // header, so every caller has to bring its own.
  const salesColPrefs = useColumnPrefs<SalesColKey>('salesTable', SALES_COLUMNS)

  if (view === 'items') {
    return (
      <ItemsTab items={items} group={null} productType="all" search="" violation={null}
        onItemsChanged={onItemsChanged} showAdd={false} onCloseAdd={() => {}} />
    )
  }
  if (view === 'sales') {
    return <SalesTab items={items} groupFilter={null} search="" violation={null} colPrefs={salesColPrefs} />
  }
  if (view === 'counts') {
    return <CountsTab items={items} groupFilter={null} search="" violation={null} />
  }
  if (view === 'loss_feed') {
    return <LossFeedTab search="" kind="loss" />
  }
  if (view === 'cab') {
    return <CABTab />
  }
  return null
}
