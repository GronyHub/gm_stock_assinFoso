// Company Laws are shown as one tile per place in the app: the Grony Cash buttons on the left sidebar and the Grony
// Manage categories. A tile is a view over laws (category + optional subcategories), so nothing moves in the database.
export type LawArea = {
  key: string; group: 'Grony Cash' | 'Grony Manage'; label: string; icon: string; blurb: string
  match: { cat: string; subs?: string[] }[]   // which laws belong here (no subs = the whole category)
  ownerOnly?: boolean                          // the page is not for staff, so neither is its tile
  training?: string                            // key in lawTraining.json (video and quiz)
  video?: string                               // a page video when there is no category video
  guide?: string                               // the page-guide key that used to sit on the page
  howto?: string[]                             // How To topic ids that now live on this tile
  flags?: boolean                              // this page has flags: list each with its explanation and fix
  addSub?: string                              // subcategory for a law added from this tile
}

export const LAW_AREAS: LawArea[] = [
  { key: 'items', group: 'Grony Cash', label: 'Items / Live Sale', icon: '🛒', blurb: 'Tapping sales, items, prices and the app words', match: [{ cat: 'Stock & records', subs: ['Item list', 'Prices', 'Recording', 'Know the words', 'Flags'] }], training: 'Stock & records', video: '/guides/sale.mp4', guide: 'sale', addSub: 'Recording', flags: true,
    howto: ['overview', 'tapping-a-sale', 'wic-vs-gmc', 'custom-quantity', 'count-now-banner', 'attention-banners', 'pack-items-gmc-only', 'item-filter', 'type-group-filter', 'search-pick-item', 'edit-item', 'count-cadence', 'exclude-from-counts', 'large-screen', 'laws-flags'] },
  { key: 'log', group: 'Grony Cash', label: 'Sales Log', icon: '📈', blurb: 'Reviewing days, receipts and fixing mistakes', match: [{ cat: 'Stock & records', subs: ['Sales Log'] }], video: '/guides/log.mp4', guide: 'log', addSub: 'Sales Log', howto: ['log-tab', 'sales-tab', 'undo-a-tap'] },
  { key: 'customers', group: 'Grony Cash', label: 'Customers', icon: '👥', blurb: 'Registering customers, WhatsApp and messages', match: [{ cat: 'Customers & WhatsApp' }], training: 'Customers & WhatsApp', video: '/guides/customers.mp4', guide: 'customers', howto: ['customers-how'] },
  { key: 'counts', group: 'Grony Cash', label: 'Counts', icon: '🔢', blurb: 'Counting stock and clearing the warnings', match: [{ cat: 'Stock & records', subs: ['Counts'] }], video: '/guides/counts.mp4', guide: 'counts', addSub: 'Counts', howto: ['count-tab-overview', 'count-records', 'count-history'] },
  { key: 'item360', group: 'Grony Cash', label: 'Item 360', icon: '🔎', blurb: 'Everything about one item', match: [{ cat: 'Stock & records', subs: ['Item 360'] }], video: '/guides/item360.mp4', guide: 'item360', addSub: 'Item 360', howto: ['item-360-how'] },
  { key: 'losses', group: 'Grony Cash', label: 'Losses & Analytics', icon: '📉', blurb: 'Where stock is lost and what sells least', match: [{ cat: 'Stock & records', subs: ['Losses and analytics'] }], addSub: 'Losses and analytics', howto: ['analytics'] },
  { key: 'bills', group: 'Grony Cash', label: 'Bills', icon: '📥', blurb: 'Recording and checking purchase bills', ownerOnly: true, match: [{ cat: 'Stock & records', subs: ['Bills'] }, { cat: 'Finance', subs: ['Bills'] }], video: '/guides/bills.mp4', guide: 'bills', addSub: 'Bills', howto: ['bills-tab'] },
  { key: 'expenses', group: 'Grony Cash', label: 'Expenses', icon: '💸', blurb: 'Recording the money the shop spends', ownerOnly: true, match: [{ cat: 'Finance', subs: ['Expenses'] }], video: '/guides/expenses.mp4', guide: 'expenses', addSub: 'Expenses' },
  { key: 'po', group: 'Grony Cash', label: 'Purchase Orders', icon: '📑', blurb: 'Ordering from vendors', ownerOnly: true, match: [{ cat: 'Stock & records', subs: ['Purchase orders'] }], video: '/guides/purchase_orders.mp4', guide: 'purchase_orders', addSub: 'Purchase orders' },
  { key: 'vendors', group: 'Grony Cash', label: 'Vendors', icon: '🏭', blurb: 'The suppliers we buy from', ownerOnly: true, match: [{ cat: 'Finance', subs: ['Vendors'] }], video: '/guides/vendors.mp4', guide: 'vendors', addSub: 'Vendors' },
  { key: 'pl', group: 'Grony Cash', label: 'P&L', icon: '💰', blurb: 'Profit and loss reading', ownerOnly: true, match: [{ cat: 'Finance', subs: ['P&L'] }], video: '/guides/pl.mp4', guide: 'pl', addSub: 'P&L' },
  { key: 'cab', group: 'Grony Cash', label: 'CAB', icon: '🏦', blurb: 'Cash at bank', ownerOnly: true, match: [{ cat: 'Finance', subs: ['CAB'] }], video: '/guides/cab.mp4', guide: 'cab', addSub: 'CAB' },

  { key: 'service', group: 'Grony Manage', label: 'Customer service', icon: '🤝', blurb: 'How we receive, serve and look after customers', match: [{ cat: 'Customer service' }], training: 'Customer service' },
  { key: 'adverts', group: 'Grony Manage', label: 'Adverts & marketing', icon: '📢', blurb: 'Photo, video and WhatsApp adverts, TV display', match: [{ cat: 'Adverts & marketing' }], training: 'Adverts & marketing' },
  { key: 'display', group: 'Grony Manage', label: 'Shop display & arrangement', icon: '🖼️', blurb: 'How goods and designs are arranged and shown', match: [{ cat: 'Shop display & arrangement' }], training: 'Shop display & arrangement' },
  { key: 'clean', group: 'Grony Manage', label: 'Cleanliness & safety', icon: '🧹', blurb: 'Cleaning, fire safety and a safe shop', match: [{ cat: 'Cleanliness & safety' }], training: 'Cleanliness & safety' },
  { key: 'equipment', group: 'Grony Manage', label: 'Equipment, power & repairs', icon: '🔌', blurb: 'Printers, power, UPS and repair works', match: [{ cat: 'Equipment, power & repairs' }], training: 'Equipment, power & repairs' },
  { key: 'staff', group: 'Grony Manage', label: 'Staff management', icon: '👥', blurb: 'Times, meetings, attendance and conduct', match: [{ cat: 'Staff management' }], training: 'Staff management' },
  { key: 'security', group: 'Grony Manage', label: 'Security & privacy', icon: '🔒', blurb: 'Customer data, accounts and personal numbers', match: [{ cat: 'Security & privacy' }], training: 'Security & privacy' },
  { key: 'finance', group: 'Grony Manage', label: 'Finance', icon: '💰', blurb: 'Cuttings and money matters', ownerOnly: true, match: [{ cat: 'Finance', subs: ['Cuttings', 'Mobile Money'] }], training: 'Finance', addSub: 'Cuttings' },
]

export const lawInArea = (a: LawArea, l: { category: string | null; subcategory: string | null }) =>
  a.match.some(m => m.cat === l.category && (!m.subs || m.subs.includes(l.subcategory ?? '')))

// An old link (?cat=Stock%20%26%20records) opens the first tile that holds that category.
export const areaForCategory = (cat: string) => LAW_AREAS.find(a => a.match.some(m => m.cat === cat))
export const areaForGuide = (guide: string) => LAW_AREAS.find(a => a.guide === guide)
export const MOVED_TOPIC_IDS = new Set(LAW_AREAS.flatMap(a => a.howto ?? []))
