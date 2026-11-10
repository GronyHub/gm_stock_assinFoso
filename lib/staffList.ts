// The ONE list of people. Everything that needs "who works here" reads from here.
//  - ACTIVE_STAFF: who works for Grony Multimedia now (also who signs the Company Laws, appears in the staff bar, can be assigned work, and is planned in the rota).
//  - FORMER_STAFF: people who have left. Their payslips, rota and time records are documentary evidence, so they stay visible in history views, but they are never
//    offered in "add", "assign", roster or rota planning, and they have no admin rights.
// To add a new person, add them to ACTIVE_STAFF (and a colour below); to retire someone, move their name to FORMER_STAFF.
export const ACTIVE_STAFF = ['grony', 'bino', 'joe', 'james']
export const FORMER_STAFF = ['rawlings']
export const EVER_STAFF = [...ACTIVE_STAFF, ...FORMER_STAFF]
export const ADMIN_STAFF = ['grony', 'joe'] // the owner and the manager at the shop

export const staffLabel = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
export const isActiveStaff = (n: string | null | undefined) => ACTIVE_STAFF.includes(String(n ?? '').toLowerCase())

export const STAFF_HEX: Record<string, string> = { joe: '#3b82f6', bino: '#a855f7', james: '#22c55e', rawlings: '#f97316', grony: '#ec4899' }
export const STAFF_BADGE: Record<string, string> = {
  joe: 'bg-blue-100 text-blue-700', bino: 'bg-purple-100 text-purple-700', james: 'bg-green-100 text-green-700', rawlings: 'bg-orange-100 text-orange-700', grony: 'bg-pink-100 text-pink-700',
}
export const STAFF_BADGE_BORDER = (n: string) => `${STAFF_BADGE[n.toLowerCase()] ?? 'bg-gray-100 text-gray-700'} ${({ joe: 'border-blue-200', james: 'border-green-200', rawlings: 'border-orange-200', bino: 'border-purple-200' } as Record<string, string>)[n.toLowerCase()] ?? 'border-gray-200'}`

// Active staff in the order the app shows them (the staff bar, pickers); anyone new is added after these.
const SHOW_ORDER = ['joe', 'bino', 'james', 'grony']
export const ACTIVE_STAFF_ORDERED = [...SHOW_ORDER.filter(n => ACTIVE_STAFF.includes(n)), ...ACTIVE_STAFF.filter(n => !SHOW_ORDER.includes(n))]
