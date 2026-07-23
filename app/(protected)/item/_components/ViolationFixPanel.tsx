'use client'
import ItemsTab from './ItemsTab'
import SalesTab from './SalesTab'
import CountsTab from './CountsTab'
import LossFeedTab from './LossFeedTab'
import CABTab from './CABTab'

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

// Which existing tab already knows how to render a filtered "fix this" view
// for a given violation type -- reused as-is here so Joe's panel can drop a
// violation open inline instead of navigating to that tab's own screen.
const ITEMS_TYPES = new Set([
  'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'unlinked_named', 'service_violation',
  'alias_prezoho_sales', 'alias_prezoho_bills', 'alias_flagged', 'alias_ambiguous',
])
const SALES_TYPES = new Set(['no_cash', 'missing_days', 'cost_price', 'dup_receipt'])
const COUNTS_TYPES = new Set(['daily', '7day', '15day'])

type Props = {
  type: string
  items: Item[]
  onItemsChanged: (items: Item[]) => void
}

export default function ViolationFixPanel({ type, items, onItemsChanged }: Props) {
  if (ITEMS_TYPES.has(type)) {
    return (
      <ItemsTab items={items} group={null} productType="all" search="" violation={type}
        onItemsChanged={onItemsChanged} showAdd={false} onCloseAdd={() => {}} />
    )
  }
  if (SALES_TYPES.has(type)) {
    return <SalesTab items={items} groupFilter={null} search="" violation={type} />
  }
  if (COUNTS_TYPES.has(type)) {
    return <CountsTab items={items} groupFilter={null} search="" violation={type} />
  }
  if (type === 'gains') {
    return <LossFeedTab search="" kind="gain" />
  }
  if (type === 'unchecked_cab') {
    return <CABTab />
  }
  // no_staff_times, no_advert, jingle_overdue, equipment_check_overdue --
  // these already land on Grony Manage via goToViolation's plain
  // changeTab('manage') fallback, with no filtered fix view of their own.
  return <p className="text-[11px] text-gray-400 py-3 px-2">Open Grony Manage to fix this.</p>
}
