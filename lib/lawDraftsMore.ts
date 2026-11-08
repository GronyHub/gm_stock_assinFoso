import sql from '@/lib/db'

// Drafted Company Laws for the remaining categories, promoted from the old Standards and the existing laws. They are
// added as drafts (seen only by the owner and manager); approving them creates their checklist tiles. Each set is added
// once. `updates` set the time/days/minutes on laws that already exist, so they can get a tile too.
type D = { cat: string; sub: string; type: 'recurring' | 'standing' | 'app'; text: string; freq?: string; days?: string; time?: string; mins?: number; proof?: 'tick' | 'photo' | 'question' | 'persons'; dos?: string; donts?: string }
type U = { id: number; type?: string; freq?: string; days?: string; time?: string; mins?: number }
const R = (cat: string, sub: string, freq: string, time: string, mins: number, text: string, o: Partial<D> = {}): D => ({ cat, sub, type: 'recurring', freq, time, mins, text, ...o })
const S = (cat: string, sub: string, text: string, o: Partial<D> = {}): D => ({ cat, sub, type: 'standing', text, ...o })
const A = (cat: string, sub: string, text: string, o: Partial<D> = {}): D => ({ cat, sub, type: 'app', text, ...o })

const CS = 'Customer service', CW = 'Customers & WhatsApp', SD = 'Shop display & arrangement', EQ = 'Equipment, power & repairs'
const ST = 'Stock & records', SM = 'Staff management', SP = 'Security & privacy', FI = 'Finance'

export const MORE_SETS: { seed: string; updates: U[]; drafts: D[] }[] = [
  { seed: 'service-v1', updates: [{ id: 46, type: 'recurring', freq: 'daily', time: '08:45', mins: 3 }], drafts: [
    R(CS, 'Complaints', 'daily', '17:15', 5, 'Check the complaint log on the left of the glass showcase: every complaint and every case of staff incompetence today is written with its date and details, and the manager has been told.'),
    S(CS, 'Receiving customers', 'Every customer is taken seriously: greeted, listened to, the order written down and a time given. This matters most for anyone who has walked in to request work.'),
    S(CS, 'Receiving customers', 'Customers are kept out of the inner shop (staff only) and are politely asked to step outside.'),
    S(CS, 'Receiving customers', 'Customers are seated. They stand only for passport photos or large format. The assistant routes customers and passes items.'),
    S(CS, 'Quality of work', 'Use the right Claude chat for each job, so an hour\'s work is done in minutes.'),
  ] },
  { seed: 'customers-v1', updates: [{ id: 20, freq: 'weekly', days: 'sat', time: '14:00', mins: 15 }, { id: 21, freq: 'weekly', days: 'sat', time: '14:30', mins: 15 }, { id: 24, freq: 'weekly', days: 'sat', time: '15:00', mins: 15 }], drafts: [
    R(CW, 'WhatsApp', 'daily', '08:35', 2, 'WhatsApp Business is working and the owner\'s UK devices are still linked.', { dos: 'Menu (3 dots), then Linked devices', donts: 'Never tap Log out on the owner\'s devices' }),
    R(CW, 'Records', 'daily', '17:45', 5, 'Sales Log checked: every row shows its customer, and missing ones are added.', { dos: 'A faint plus sign in the Customer column means none is recorded: tap it and add the GM number, phone or name' }),
    R(CW, 'WhatsApp', 'monthly', '11:00', 10, 'Test the WhatsApp greeting message from another phone to check that it works.'),
    R(CW, 'WhatsApp', 'weekly', '17:00', 10, 'WhatsApp check-in with the owner: posts, enquiries, faults and stock needed.', { days: 'mon' }),
    S(CW, 'New customers', 'Every new customer is registered with a GM number (New Customer, or the GM box). Their number goes out with their first receipt message.'),
    S(CW, 'New customers', 'Each customer\'s files are kept only in a folder named with their GM number, and their WhatsApp contact is saved as "GM24 - Full Name".'),
    S(CW, 'New customers', 'A customer who is not sending work on WhatsApp is asked to send "hi" to the company number, and the contact is then saved with their GM number.'),
    A(CW, 'Sales and customers', 'Every sale to a known customer carries their GM number or 10-digit phone in the GM box. A phone number not on our list is saved as a new customer, and the WhatsApp purchase message is sent after each sale with a customer.'),
  ] },
  { seed: 'display-v1', updates: [], drafts: [
    R(SD, 'Arrangement', 'daily', '09:05', 5, 'Arrangement check with a photo: goods in like terms (same type, same side, label out), old goods in front and new behind, nothing on the floor.', { proof: 'photo' }),
    R(SD, 'Arrangement', 'daily', '18:35', 5, 'Tables decluttered and everything back in its labelled place.'),
    R(SD, 'Customer display', 'weekly', '10:30', 10, 'Customer Display check with a photo: every service has its design displayed, and no other company\'s logo, design or advert is anywhere in the shop.', { days: 'wed', proof: 'photo' }),
    R(SD, 'Arrangement', 'weekly', '09:30', 5, 'Pen on a rope on the customers\' table at Grony 2: the rope is secure and the pen writes.', { days: 'mon' }),
    R(SD, 'Customer display', 'monthly', '10:00', 30, 'Take shop photos with descriptions and send them to the owner: front and signboard, Grony 1 to 7, large format, inner shop, both showcases and the charging point.', { dos: 'For each photo: the area, what is there, what changed and any problem' }),
    R(SD, 'Customer display', 'monthly', '10:20', 5, 'The signboard and banner are in good condition, with GRONY MULTIMEDIA in bold.'),
    S(SD, 'Arrangement', 'Hanging items go on the last shelf of the Boys\' showcase. The lower shelf is kept for faulty items.'),
    S(SD, 'Arrangement', 'No banners at Grony 6 and 7.'),
    S(SD, 'Storage', 'Pen drives, memory cards and routers go back into the showcase or Grony 3 or 4 straight after use.'),
  ] },
  { seed: 'equipment-v1', updates: [{ id: 56, type: 'recurring', freq: 'daily', time: '09:05', mins: 5 }], drafts: [
    R(EQ, 'Power', 'daily', '08:35', 2, 'UPS is on, charging and connected to the Epson EcoTanks.'),
    R(EQ, 'Printers', 'daily', '09:20', 3, 'Every printer\'s letter sticker matches its name on the screen.', { dos: 'Settings, Printers and scanners, Printer properties, General: name it exactly as on the Grony 2 sheet, for example "B - Epson ET-2860" (letter first, plain hyphen), then print a test page' }),
    R(EQ, 'Printers', 'daily', '09:25', 10, 'Every printer is tested and faults are reported.', { dos: 'Put the faulty item on the lower shelf of the Boys\' showcase with a note: item, fault, date and your name\nTell Joe the same day. Joe informs the owner and arranges the repair' }),
    R(EQ, 'Phones', 'daily', '08:45', 2, 'The company phone is charged and with Joe, and connected to the shop Wi-Fi with both EcoTanks.'),
    R(EQ, 'Closing', 'daily', '18:50', 5, 'Closing power-down: laptops shut down, TV off, printers off at their button but still plugged in and on USB, UPS charging, sockets not overloaded.'),
    R(EQ, 'Repairs', 'daily', '17:20', 3, 'Repair Works: is anything in the shop broken or needing repair?', { proof: 'question' }),
    R(EQ, 'Repairs', 'monthly', '14:00', 10, 'Every repair needed is listed as a task in the GM app with a deadline.'),
    R(EQ, 'Printers', 'monthly', '14:30', 20, 'Printer drivers still work: print a test page from each printer, and check each printer\'s Claude chat and information sticker are in place.'),
    R(EQ, 'Printers', 'monthly', '15:00', 15, 'The location chart and the Printer Register are correct, and the printer stickers are updated.'),
    R(EQ, 'Computers', 'monthly', '15:20', 5, 'AnyDesk works on both computers.'),
    R(EQ, 'Computers', 'weekly', '15:30', 3, 'The Windows USB is present and in its place (always keep one).', { days: 'fri' }),
    S(EQ, 'Printers', 'Every printer has a letter sticker, an information sticker with safe-use rules, its correct driver and its own Claude chat. Flag any printer without a chat to the owner.'),
    S(EQ, 'Printers', 'Sound card and mic are used only for jingles, voiceovers and info-centre adverts, recorded in batches and saved to Drive.'),
  ] },
  { seed: 'stock-v1', updates: [], drafts: [
    R(ST, 'Counts', 'daily', '12:30', 10, 'COUNT NOW items counted; warning banners cleared.', { dos: 'Tap the item, count the shelf, submit\nMissing SP, CP or group: Edit, then Save\nNegative stock: look for an unentered bill\nNet gain: check the count history for a miscount, an unrecorded receipt or a duplicate' }),
    R(ST, 'Item list', 'weekly', '11:00', 10, 'Item groups checked: every good is in the right group.', { days: 'wed' }),
    R(ST, 'Prices', 'monthly', '11:30', 10, 'The price list is current and every staff member has it.'),
    A(ST, 'Recording', 'Every walk-in sale goes in Live Sale with WIC on (GMC only for the shop\'s own use). A customer buying several items is sold through MI: one basket, one receipt.'),
    A(ST, 'Recording', 'Past days are entered only with + Past sale and the right sale date. The same work is never typed twice.'),
    A(ST, 'Recording', 'Receipts are issued from MI or the Sales Log, never typed into Customer Receipts. A sale the app refuses (price below cost, not enough stock) is not forced: tell Joe.'),
    S(ST, 'Know the words', 'App words: SOH stock on hand, SP selling price, CP cost price, WIC walk-in customer, GMC Grony Multimedia as customer, CAB cash at bank. Search the Handbook before asking.'),
  ] },
  { seed: 'staff-v1', updates: [{ id: 4, type: 'recurring', freq: 'monthly', time: '16:00', mins: 30 }], drafts: [
    R(SM, 'Dress code', 'daily', '09:00', 3, 'Dress code: everyone at work is wearing the company T-shirt and the employee tag.', { proof: 'persons' }),
    R(SM, 'Behaviour', 'daily', '15:30', 3, 'Team behaviour: any negative behaviour by staff so far today?', { proof: 'question', dos: 'Report: arriving late, rudeness, using the phone while customers wait, leaving the counter, arguing' }),
    R(SM, 'Behaviour', 'daily', '17:30', 3, 'Team behaviour (end of day): any negative behaviour by staff today?', { proof: 'question' }),
    R(SM, 'Opening and closing', 'daily', '08:30', 5, 'Opening questions answered in the app (Opener). The first staff member in is the Opener.'),
    R(SM, 'Opening and closing', 'daily', '18:55', 5, 'Closing questions answered in the app (Closer) before you clock out.'),
    R(SM, 'Rota', 'weekly', '09:30', 10, 'The team rota for the week is set and everyone knows it.', { days: 'mon' }),
    R(SM, 'Assessments', 'monthly', '16:30', 30, 'Staff assessment: every staff member assessed for the month.'),
    S(SM, 'Conduct', 'Report problems early: a small fault today saves a big cost tomorrow.'),
    S(SM, 'Training', 'Every staff member is taken through the checklist, the fire extinguisher and the alarm test.'),
  ] },
  { seed: 'security-v1', updates: [], drafts: [
    R(SP, 'CCTV', 'daily', '09:15', 3, 'Joe checks the CCTV app: every camera is showing.'),
    R(SP, 'CCTV', 'weekly', '10:30', 5, 'CCTV is recording and the owner\'s devices are still linked.', { days: 'mon' }),
    R(SP, 'Unfortunate events', 'daily', '18:20', 3, 'Unfortunate events: did anything unfortunate happen today?', { proof: 'question', dos: 'Report a theft, accident, damage, dispute, power cut or anything that could affect the shop' }),
    R(SP, 'Locking up', 'daily', '19:00', 3, 'Locked up: the gate area is clear and the shop is locked.'),
    R(SP, 'Accounts', 'weekly', '16:30', 10, 'The phone and both computers have only approved apps, and nothing new has been installed.', { days: 'fri', dos: 'Phone: Settings, Apps, Uninstall\nPC: Settings, Apps, Installed apps, 3 dots, Uninstall\nUnsure? Ask Joe' }),
    R(SP, 'Accounts', 'monthly', '15:40', 15, 'Facebook Page roles and Chrome profiles match the current staff. Leavers are removed the same day.'),
    S(SP, 'Accounts', 'Each staff member works in their own Chrome profile with the company account only. No personal email is signed in on any browser.'),
  ] },
  { seed: 'finance-v1', updates: [{ id: 18, type: 'recurring', freq: 'weekly', days: 'sat', time: '17:00', mins: 10 }], drafts: [
    R(FI, 'Bills', 'weekly', '11:00', 15, 'Last week\'s bills checked: each has its receipt attached, the vendor name, a full list of goods adding up to the total, and canonical item names.', { days: 'mon' }),
    S(FI, 'Mobile Money', 'The company number is also the company Mobile Money number. Customers pay only to it.'),
  ] },
]

export async function seedMoreLaws() {
  for (const set of MORE_SETS) {
    try {
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = ${set.seed}`
      if (n > 0) continue
      for (const u of set.updates) {
        await sql`UPDATE page_laws SET law_type = COALESCE(${u.type ?? null}, law_type), frequency = COALESCE(${u.freq ?? null}, frequency), days = COALESCE(${u.days ?? null}, days),
          law_time = COALESCE(law_time, ${u.time ?? null}), minutes = COALESCE(minutes, ${u.mins ?? null}) WHERE id = ${u.id}`
      }
      for (const d of set.drafts) {
        await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, status, seed, proof)
          VALUES (${d.cat}, ${d.text}, false, 'law', ${d.cat}, ${d.sub}, ${d.type}, ${d.days ?? null}, ${d.time ?? null}, ${d.freq ?? null}, ${d.mins ?? null}, ${d.dos ?? null}, ${d.donts ?? null}, 'draft', ${set.seed}, ${d.proof ?? 'tick'})`
      }
    } catch (e) { console.error('law drafts seed failed:', set.seed, e instanceof Error ? e.message : String(e)) }
  }
}
