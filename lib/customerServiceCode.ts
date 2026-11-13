// The Customer Service Code -- single source of truth. Shown in the strip at the top of every page and the start-of-day card, and used by the
// staff acknowledgement. Raise CODE_VERSION when the rules change in a way staff must agree to again.
export const CODE_VERSION = 1

export type CodeSection = { id: string; title: string; rules: { code: string; title?: string; text: string }[] }

export const CUSTOMER_SERVICE_CODE: CodeSection[] = [
  { id: 'A', title: 'Identity and appearance', rules: [
    { code: 'CS-1', title: 'Employee tag (mandatory).', text: 'Wear your employee tag at all times while at work, visible on your chest. It lets customers identify you and know your role.' },
    { code: 'CS-2', text: 'Never lend, swap or share a tag. Report a lost tag to the manager the same day.' },
    { code: 'CS-3', text: 'A staff member without a tag does not serve customers until it is replaced.' },
    { code: 'CS-4', text: 'Dress neatly and keep your workstation and the counter clean and tidy.' },
    { code: 'CS-5', text: 'Keep personal phone use, food and loud personal talk away from the customer area.' },
  ] },
  { id: 'B', title: 'Receiving a customer', rules: [
    { code: 'CS-6', text: 'Greet every customer within 10 seconds, even if you are busy: "Welcome to Grony Multimedia, how can I help you?"' },
    { code: 'CS-7', text: 'Stop what you are doing, look at the customer and smile. Do not stay on your phone.' },
    { code: 'CS-8', text: 'If you are with another customer, acknowledge the new one ("I\'ll be with you shortly") and offer a seat.' },
    { code: 'CS-9', text: 'Treat every customer the same, whether they buy GH₵1 or GH₵1,000.' },
    { code: 'CS-10', text: 'Say your name and role if asked. Never ignore a customer.' },
  ] },
  { id: 'C', title: 'Interacting', rules: [
    { code: 'CS-11', text: 'Ask what the customer needs and listen fully before you suggest anything.' },
    { code: 'CS-12', text: 'Before starting any job, tell the customer the price, the time it will take and what exactly will be done. Repeat it back to confirm.' },
    { code: 'CS-13', text: 'Be honest. If you don\'t know, say "Let me check" and ask a colleague or the manager. Never guess prices or promise unrealistic times.' },
    { code: 'CS-14', text: 'Use polite words: please, thank you, sorry, you\'re welcome.' },
    { code: 'CS-15', text: 'Never argue, shout, mock, or make jokes at a customer\'s expense. Never discuss one customer with another.' },
    { code: 'CS-16', text: 'Suggest our other services and goods when they genuinely fit the customer\'s need.' },
  ] },
  { id: 'D', title: 'Money, privacy and receipts', rules: [
    { code: 'CS-17', text: 'No personal phone number or personal MoMo number is given to any customer. Payments go only to the company MoMo number or the till.' },
    { code: 'CS-18', text: 'Every sale gets a receipt, and every job gets a customer or a label in Live.' },
    { code: 'CS-19', text: 'Never share or reuse customer details, files or logins. Delete or hand over customers\' documents as agreed.' },
    { code: 'CS-20', text: 'Tell the customer the total clearly and give the correct change.' },
  ] },
  { id: 'E', title: 'Doing the work', rules: [
    { code: 'CS-21', text: 'Check the work with the customer before they pay, such as spelling on prints and the right size, colour and quantity.' },
    { code: 'CS-22', text: 'If you make a mistake, say so, apologise and fix it at no extra charge. Never hide an error.' },
    { code: 'CS-23', text: 'Meet the time you promised. If you will be late, tell the customer before they ask.' },
    { code: 'CS-24', text: 'Keep customers\' items safe and labelled. Return exactly what belongs to them.' },
  ] },
  { id: 'F', title: 'Complaints and difficult customers', rules: [
    { code: 'CS-25', text: 'Stay calm. Let the customer finish, apologise sincerely ("I\'m sorry about that"), and say what you will do.' },
    { code: 'CS-26', text: 'Never blame a colleague in front of a customer.' },
    { code: 'CS-27', text: 'If you can\'t resolve it, call the manager politely. Do not argue.' },
    { code: 'CS-28', text: 'Log every complaint on the complaint log with date and details.' },
  ] },
  { id: 'G', title: 'Closing and aftercare', rules: [
    { code: 'CS-29', text: 'Thank the customer, give the receipt, and say when to expect pickup or delivery.' },
    { code: 'CS-30', text: 'Invite them to join the WhatsApp page and send the receipt there, with their permission.' },
    { code: 'CS-31', text: 'Follow up on larger jobs within 24 hours. Reply to WhatsApp messages as soon as possible.' },
  ] },
  { id: 'H', title: 'Staff conduct', rules: [
    { code: 'CS-32', text: 'Respect your colleagues in front of customers. Support each other.' },
    { code: 'CS-33', text: 'Report any customer service problem to the manager promptly.' },
  ] },
]

export const ALL_RULES = CUSTOMER_SERVICE_CODE.flatMap(s => s.rules.map(r => ({ ...r, section: s.title })))

// One rule per day, the same for everyone, rotating through the whole Code. `dateStr` is YYYY-MM-DD.
export function ruleOfDay(dateStr: string) {
  const day = Math.floor(Date.parse(dateStr + 'T00:00:00Z') / 86400000)
  return ALL_RULES[((day % ALL_RULES.length) + ALL_RULES.length) % ALL_RULES.length]
}

// Rotating one-liners for the always-visible strip: short versions of the rules that matter most while serving.
export const STRIP_LINES: { code: string; text: string }[] = [
  { code: 'CS-1', text: 'Wear your employee tag at all times.' },
  { code: 'CS-6', text: 'Greet every customer within 10 seconds.' },
  { code: 'CS-7', text: 'Stop, look up and smile. Phone away.' },
  { code: 'CS-12', text: 'Agree price, time and work before you start.' },
  { code: 'CS-13', text: 'Not sure? Say "Let me check". Never guess.' },
  { code: 'CS-15', text: 'Never argue or mock a customer.' },
  { code: 'CS-17', text: 'Never give a personal phone or MoMo number.' },
  { code: 'CS-18', text: 'Every sale gets a receipt and a customer or label.' },
  { code: 'CS-21', text: 'Check the work with the customer before they pay.' },
  { code: 'CS-23', text: 'Late? Tell the customer before they ask.' },
  { code: 'CS-25', text: 'Complaint? Stay calm, apologise, say what you will do.' },
  { code: 'CS-29', text: 'Thank the customer and say when to expect pickup.' },
  { code: 'CS-30', text: 'Invite them to join the WhatsApp page.' },
]

// Short follow-up shown a moment after a sale is saved (never blocks anything). Rotates through the closing rules.
const AFTER_SALE_HINTS = [
  'Thank the customer and give the receipt. (CS-29)',
  'Tell them when to expect pickup or delivery. (CS-29)',
  'Invite them to join our WhatsApp page. (CS-30)',
  'Did you check the work with the customer before they paid? (CS-21)',
  'Smile and say thank you. Every customer, every time. (CS-14)',
]
let hintCounter = Math.floor(Math.random() * AFTER_SALE_HINTS.length)
export function nextAfterSaleHint() { return '🤝 ' + AFTER_SALE_HINTS[hintCounter++ % AFTER_SALE_HINTS.length] }
