// Company Laws: the categories every law belongs to (compulsory), the three law types, and how a schedule reads.
export type LawType = 'recurring' | 'standing' | 'app'
export const LAW_TYPES: { key: LawType; label: string; help: string }[] = [
  { key: 'recurring', label: 'Recurring task', help: 'Done on a schedule. Becomes a tile in Waiting for team.' },
  { key: 'standing', label: 'Standing rule', help: 'Always applies. No tile; kept in mind all day.' },
  { key: 'app', label: 'App-enforced', help: 'The app checks this itself and raises a flag.' },
]
export const LAW_CATEGORIES: { key: string; icon: string; blurb: string }[] = [
  { key: 'Customer service', icon: '🤝', blurb: 'How we receive, serve and look after customers' },
  { key: 'Customers & WhatsApp', icon: '💬', blurb: 'Registering customers, WhatsApp and messages' },
  { key: 'Adverts & marketing', icon: '📢', blurb: 'Photo, video and WhatsApp adverts, TV display' },
  { key: 'Shop display & arrangement', icon: '🖼️', blurb: 'How goods and designs are arranged and shown' },
  { key: 'Cleanliness & safety', icon: '🧹', blurb: 'Cleaning, fire safety and a safe shop' },
  { key: 'Equipment, power & repairs', icon: '🔌', blurb: 'Printers, power, UPS and repair works' },
  { key: 'Stock & records', icon: '📦', blurb: 'Items, counts, bills, sales and recording' },
  { key: 'Staff management', icon: '👥', blurb: 'Times, meetings, attendance and conduct' },
  { key: 'Security & privacy', icon: '🔒', blurb: 'Customer data, accounts and personal numbers' },
  { key: 'Finance', icon: '💰', blurb: 'CAB, cuttings and money matters' },
]
export const UNCATEGORISED = 'Needs a category'

// Where a law added the old way (from a page's own flag icon) goes until the owner moves it.
export const CATEGORY_FOR_SCOPE: Record<string, string> = {
  Arrangement: 'Shop display & arrangement', 'Customer Display': 'Shop display & arrangement', Bills: 'Stock & records', 'Purchase Orders': 'Stock & records',
  Items: 'Stock & records', Counts: 'Stock & records', Sales: 'Stock & records', CAB: 'Finance', Cuttings: 'Finance', WhatsApp: 'Customers & WhatsApp',
  'New Customer': 'Customers & WhatsApp', Video: 'Adverts & marketing', 'Repair Works': 'Equipment, power & repairs', 'Team Meeting': 'Staff management',
  'Team Times': 'Staff management', 'Unfortunate Events': 'Security & privacy',
}

export const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const DAY_NAMES: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
export const LAW_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

// "Every Monday and Thursday, 10:00, 10 min" -- the schedule of a recurring law in words.
export function scheduleText(l: { law_type: string; days?: string | null; law_time?: string | null; frequency?: string | null; minutes?: number | null }): string {
  if (l.law_type !== 'recurring') return ''
  const days = (l.days ?? '').split(',').map(d => d.trim()).filter(Boolean)
  const when = days.length && days.length < 7 ? `Every ${days.map(d => DAY_NAMES[d]).join(' and ')}` : l.frequency === 'weekly' ? 'Weekly' : l.frequency === 'monthly' ? 'Monthly' : l.frequency === 'daily' ? 'Every day' : ''
  const parts = [when, l.law_time ?? '', l.minutes ? `${l.minutes} min` : ''].filter(Boolean)
  return parts.length ? parts.join(', ') : 'No schedule set yet'
}

// Words that mark an old checklist tile as possibly replaced by this category's laws (used by the review list on a
// category's screen; nothing is stopped until the owner ticks tiles and confirms).
export const CATEGORY_KEYWORDS: Record<string, string> = {
  'Adverts & marketing': 'advert|tiktok|facebook|capcut|jingle|status|clip|video|meta |tv |post|social|whatsapp group|channel|banner printing',
  'Cleanliness & safety': 'clean|mop|sweep|dust|bin|rubbish|waste|wipe|tidy|toilet|fire|extinguisher|smok|alarm|food|drink|eating|cable|extension|flame|exit|laminator',
  'Customer service': 'greet|customer|complain|receipt|welcome|queue',
  'Customers & WhatsApp': 'whatsapp|register|customer|bulk|message',
  'Shop display & arrangement': 'arrang|display|showcase|poster|shelf|shelves|sticker|signboard|tv ',
  'Equipment, power & repairs': 'printer|power|ups|usb|toner|ink|repair|charger|laptop|scanner|computer',
  'Stock & records': 'stock|count|item|bill|sale|record|price|receipt',
  'Staff management': 'staff|clock|meeting|rota|dress|shirt|behaviour|late|attendance',
  'Security & privacy': 'password|private|login|cctv|lock|security|email',
  Finance: 'cab|cash|bank|cutting|momo|expense',
}
export const PROOFS = [
  { key: 'tick', label: 'Tick when done' }, { key: 'photo', label: 'Photo and note' },
  { key: 'question', label: 'Question: all good or report a problem' }, { key: 'persons', label: 'Tick each person at work' },
] as const
