// The flags the app raises, each tied to one law. Kept free of server code so the laws screen can use it in the browser.
// `list` is where the app reads the open items from: a list in /api/flags, the items themselves, or the count lists.
export type FlagDef = {
  key: string; label: string; page: string           // page: where the flagged items are fixed
  list: string                                       // 'items:neg' | 'items:no_sp' | 'items:no_cp' | 'count' | 'flags:<name>'
  law: string                                        // the draft law, in plain words
  breaks: string                                     // the violation line
}
export const FLAG_PAGES: Record<string, string> = { live: 'Live', log: 'Sales Log', bills: 'Bills', loss: 'Losses', team: 'Staff times', adverts: 'Adverts and audio', expenses: 'Expenses', customers: 'Customers', vendors: 'Vendors' }
export const FLAGS: FlagDef[] = [
  { key: 'neg_soh', label: 'Negative stock', page: 'live', list: 'items:neg', law: 'No item has negative stock. Any item below zero is counted and its cause found and fixed.', breaks: 'Negative stock is left open' },
  { key: 'no_sp', label: 'No selling price', page: 'live', list: 'items:no_sp', law: 'Every item has a selling price above zero.', breaks: 'An item is left with no selling price' },
  { key: 'no_cp', label: 'No cost price', page: 'live', list: 'items:no_cp', law: 'Every item that is bought has a cost price above zero.', breaks: 'A bought item is left with no cost price' },
  { key: 'no_group', label: 'No group', page: 'live', list: 'flags:noGroup', law: 'Every item belongs to a group.', breaks: 'An item is left with no group' },
  { key: 'duplicates', label: 'Possible duplicate items', page: 'live', list: 'flags:duplicates', law: 'No item exists twice. A possible duplicate is checked and, if it is the same item, merged.', breaks: 'A possible duplicate is left unchecked' },
  { key: 'unlinked_named', label: 'Unlinked sales', page: 'live', list: 'flags:unlinkedNamed', law: 'Every sale is linked to a real item.', breaks: 'An unlinked sale is left unfixed' },
  { key: 'unknown_qty', label: 'Unknown quantity', page: 'live', list: 'flags:unknownQty', law: 'Every item has a known quantity.', breaks: 'An item with unknown quantity is left open' },
  { key: 'gmc_overage', label: 'GMC pack overage', page: 'live', list: 'flags:gmcOverage', law: 'GMC packs never go over their stock. An overage is corrected.', breaks: 'A GMC pack overage is left open' },
  { key: 'low_confidence_alias', label: 'Alias needs check', page: 'live', list: 'flags:lowConfidenceAlias', law: 'Every alias that the app is unsure about is checked.', breaks: 'An alias that needs checking is left open' },
  { key: 'prezoho_notes', label: 'Ledger notes', page: 'live', list: 'flags:prezohoNotes', law: 'Every ledger note on an item is read and cleared.', breaks: 'A ledger note is left open' },
  { key: 'to_count', label: 'To count', page: 'live', list: 'count', law: 'Items that are due a count are counted.', breaks: 'Counts that are due are left uncounted' },
  { key: 'cost_gte_sp', label: 'Cost at or above selling price', page: 'live', list: 'flags:costGteSell', law: 'No item has a cost price at or above its selling price. It is checked and corrected.', breaks: 'An item with cost at or above its selling price is left open' },
  { key: 'no_cash', label: 'No cash counted', page: 'log', list: 'flags:noCash', law: 'Every day has its cash counted in the Sales Log.', breaks: 'A day is left with no cash counted' },
  { key: 'missing_days', label: 'Missing sales days', page: 'log', list: 'flags:missingDays', law: 'Every working day has its sales recorded in the Sales Log.', breaks: 'A working day has no sales recorded' },
  { key: 'dup_receipts', label: 'Duplicate receipts', page: 'log', list: 'flags:dupReceipts', law: 'No receipt is recorded twice. A duplicate receipt is checked and removed.', breaks: 'A duplicate receipt is left open' },
  { key: 'high_wnw', label: 'High walk-in share', page: 'log', list: 'flags:highWnw', law: 'Sales are recorded to the customer who bought, not to the walk-in customer. A day with too many walk-in sales is reviewed.', breaks: 'A day with a high walk-in share is left unreviewed' },
  { key: 'no_vendor_bills', label: 'Bills with no vendor', page: 'bills', list: 'flags:noVendorBills', law: 'Every bill has its vendor recorded.', breaks: 'A bill is left with no vendor' },
  { key: 'no_items_bills', label: 'Bills with no item list', page: 'bills', list: 'flags:noItemsBills', law: 'Every bill has its full item list.', breaks: 'A bill is left with no item list' },
  { key: 'bill_total_mismatch', label: 'Bills whose total does not match', page: 'bills', list: 'flags:billTotalMismatch', law: 'Every bill\'s items add up to its total.', breaks: 'A bill is left with a total that does not match' },
  { key: 'bill_no_attachment', label: 'Bills with no attachment', page: 'bills', list: 'flags:billNoAttachment', law: 'Every bill has its receipt attached.', breaks: 'A bill is left with no receipt attached' },
  { key: 'bill_no_expense', label: 'Bills with no expense', page: 'bills', list: 'flags:billNoExpense', law: 'Every bill has its expense recorded.', breaks: 'A bill is left with no expense' },
  { key: 'vcp_jump', label: 'Cost price jumps', page: 'bills', list: 'flags:vcpJumps', law: 'A cost price that jumps by 20% or more from the previous bill is checked and corrected.', breaks: 'A cost price jump is left unchecked' },
  { key: 'unchecked_cab', label: 'Cash at bank not checked', page: 'log', list: 'flags:uncheckedCab', law: 'Cash at bank is checked and confirmed every week.', breaks: 'Cash at bank is left unchecked' },
  { key: 'no_staff_times', label: 'Missing staff times', page: 'team', list: 'flags:noStaffTimes', law: 'Every day a staff member worked has their times recorded.', breaks: 'A day is left with missing staff times' },
  { key: 'open_clocks', label: 'Days with no clock-out', page: 'team', list: 'flags:openClocks', law: 'Every day someone clocked in has their clock-out recorded.', breaks: 'A day with no clock-out is left open' },
  { key: 'missing_closing_reports', label: 'Missing closing reports', page: 'team', list: 'flags:missingClosingReports', law: 'Every working day has its closing report.', breaks: 'A working day has no closing report' },
  { key: 'no_advert', label: 'Items with no audio advert', page: 'adverts', list: 'flags:noAdvert', law: 'Every item has an audio advert.', breaks: 'An item is left with no audio advert' },
  { key: 'alias_prezoho_sales', label: 'Pre-Zoho sales aliases', page: 'live', list: 'extra', law: 'Every pre-Zoho sales name is matched to the right item.', breaks: 'A pre-Zoho sales name is left unmatched' },
  { key: 'alias_prezoho_bills', label: 'Pre-Zoho bills aliases', page: 'live', list: 'extra', law: 'Every pre-Zoho bill name is matched to the right item.', breaks: 'A pre-Zoho bill name is left unmatched' },
  { key: 'alias_prezoho_receipts', label: 'Pre-Zoho receipts aliases', page: 'live', list: 'extra', law: 'Every receipt name the app could not match is matched to the right item.', breaks: 'A receipt name is left unmatched' },
  { key: 'alias_flagged', label: 'Flagged aliases', page: 'live', list: 'extra', law: 'No alias points to an item whose name contradicts it. Each is reassigned or dismissed.', breaks: 'A flagged alias is left open' },
  { key: 'alias_ambiguous', label: 'Ambiguous aliases', page: 'live', list: 'extra', law: 'A name never maps to more than one item. The right item is picked for each.', breaks: 'An ambiguous alias is left open' },
  { key: 'alias_name_conflicts', label: 'Alias name conflicts', page: 'live', list: 'extra', law: 'No alias has the same text as a different item\'s own name.', breaks: 'An alias name conflict is left open' },
  { key: 'service_violation', label: 'Service violations', page: 'live', list: 'extra', law: 'A service item never has stock counts, GMC use or bill activity.', breaks: 'A service violation is left open' },
  { key: 'needs_review', label: 'Items needing review', page: 'live', list: 'extra', law: 'Every item marked as needing review is reviewed and cleared.', breaks: 'An item needing review is left open' },
  { key: 'empty_row', label: 'Empty rows', page: 'live', list: 'extra', law: 'No item has a day with nothing in it (no count, sales, GMC or bills). The empty day is removed.', breaks: 'An empty day is left on an item' },
  { key: 'net_gain', label: 'Net gains', page: 'live', list: 'extra', law: 'No item is left with a net gain. A gain means a bill or GMC take was never recorded, or a count was wrong, and it is corrected.', breaks: 'A net gain is left open' },
  { key: 'net_loss', label: 'Net losses', page: 'live', list: 'extra', law: 'Every item with a net loss is looked into and its cause found.', breaks: 'A net loss is left uninvestigated' },
  { key: 'exp_similar', label: 'Expenses: similar account names', page: 'expenses', list: 'extra', law: 'No two expense accounts are almost the same name. They are merged into one.', breaks: 'Similar expense account names are left open' },
  { key: 'exp_bundled', label: 'Expenses: bundled purchases', page: 'expenses', list: 'extra', law: 'Each purchase has its own expense line. Several purchases are not lumped into one.', breaks: 'A bundled expense is left open' },
  { key: 'exp_no_vendor', label: 'Expenses with no vendor', page: 'expenses', list: 'extra', law: 'Every expense has its vendor recorded.', breaks: 'An expense is left with no vendor' },
  { key: 'exp_property_no_location', label: 'Properties with no location', page: 'expenses', list: 'extra', law: 'Every available property expense has its location recorded.', breaks: 'A property is left with no location' },
  { key: 'exp_delivery_unresolved', label: 'Delivery expenses unresolved', page: 'expenses', list: 'extra', law: 'Every delivery expense is moved onto its bill or marked as related to its property.', breaks: 'A delivery expense is left unresolved' },
  { key: 'cust_missing', label: 'Customers missing details', page: 'customers', list: 'extra', law: 'Every customer has a location, phone, email and WhatsApp group.', breaks: 'A customer is left with missing details' },
  { key: 'vend_missing', label: 'Vendors missing details', page: 'vendors', list: 'extra', law: 'Every vendor has a phone and a location.', breaks: 'A vendor is left with missing details' },
]
export const flagOf = (k: string | null | undefined) => FLAGS.find(f => f.key === k)
