import sql from '@/lib/db'
import { once } from '@/lib/once'
import { parseViolations } from '@/lib/lawViolations'

// One row per law, scoped to a page the same way custom_tasks/page_notes
// are (scope_key namespace) -- unlike Notes (PageLawsNote, still one
// freeform textarea per page), Law is a real list so PageToolIcons can
// badge the page with how many laws it actually has, not just whether the
// box is empty.
async function ensurePageLawsTableImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS page_laws (
      id SERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      display_in_carousel BOOLEAN DEFAULT false,
      carousel_message TEXT,
      carousel_order INTEGER,
      carousel_type TEXT CHECK (carousel_type IN ('help', 'law', 'announcement')) DEFAULT 'law'
    )
  `.catch(() => {})

  // Migrate existing columns if they don't exist
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS display_in_carousel BOOLEAN DEFAULT false`.catch(() => {})
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS carousel_message TEXT`.catch(() => {})
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS carousel_order INTEGER`.catch(() => {})
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS carousel_type TEXT DEFAULT 'law'`.catch(() => {})
}

export const ensurePageLawsTable = once(ensurePageLawsTableImpl)

// Company Laws: every law carries a category (compulsory), a subcategory, a type, and for recurring tasks a schedule.
// The first time this runs, the laws that already exist are sorted into categories (only where none is set yet).
const FIRST_SORT: [number, string, string, string, string | null, string | null][] = [
  // id, category, subcategory, type, days, frequency
  [12, 'Shop display & arrangement', 'Arranging goods', 'standing', null, null], [13, 'Shop display & arrangement', 'Arranging goods', 'standing', null, null],
  [14, 'Shop display & arrangement', 'Arranging goods', 'standing', null, null], [15, 'Shop display & arrangement', 'Arranging goods', 'standing', null, null],
  [16, 'Shop display & arrangement', 'Storage', 'standing', null, null],
  [27, 'Shop display & arrangement', 'Customer display', 'standing', null, null], [28, 'Shop display & arrangement', 'Customer display', 'standing', null, null],
  [29, 'Shop display & arrangement', 'Customer display', 'standing', null, null],
  [3, 'Stock & records', 'Bills', 'app', null, null], [11, 'Stock & records', 'Purchase orders', 'standing', null, null], [40, 'Stock & records', 'Counts', 'app', null, null],
  [34, 'Stock & records', 'Item list', 'standing', null, null], [35, 'Stock & records', 'Item list', 'app', null, null],
  [5, 'Stock & records', 'Recording', 'app', null, null], [8, 'Stock & records', 'Recording', 'app', null, null],
  [18, 'Finance', 'CAB', 'recurring', 'sat', 'weekly'], [26, 'Finance', 'Cuttings', 'standing', null, null],
  [1, 'Staff management', 'Time and clocking', 'standing', null, null], [22, 'Staff management', 'Attendance', 'standing', null, null], [4, 'Staff management', 'Meetings', 'recurring', null, 'monthly'],
  [46, 'Customer service', 'Callbacks', 'standing', null, null], [47, 'Customer service', 'Complaints', 'standing', null, null], [49, 'Customer service', 'Quality of work', 'standing', null, null],
  [59, 'Customer service', 'Customer Service Code', 'standing', null, null], [60, 'Customer service', 'Customer Service Code', 'standing', null, null], [61, 'Customer service', 'Customer Service Code', 'standing', null, null],
  [54, 'Security & privacy', 'Customer data', 'standing', null, null], [45, 'Security & privacy', 'Accounts', 'standing', null, null],
  [52, 'Security & privacy', 'Personal numbers', 'standing', null, null], [53, 'Security & privacy', 'Personal numbers', 'standing', null, null],
  [55, 'Equipment, power & repairs', 'Power', 'standing', null, null], [56, 'Equipment, power & repairs', 'Printers', 'recurring', null, 'daily'], [17, 'Equipment, power & repairs', 'Repairs', 'standing', null, null],
  [57, 'Cleanliness & safety', 'Fire safety', 'recurring', 'wed', 'weekly'], [58, 'Cleanliness & safety', 'Fire safety', 'standing', null, null],
  [20, 'Customers & WhatsApp', 'New customers', 'recurring', null, null], [21, 'Customers & WhatsApp', 'Bulk messages', 'recurring', null, null],
  [23, 'Customers & WhatsApp', 'Responding', 'standing', null, null], [48, 'Customers & WhatsApp', 'Responding', 'standing', null, null],
  [24, 'Customers & WhatsApp', 'Growing the page', 'recurring', null, 'weekly'], [50, 'Customers & WhatsApp', 'Chat rules', 'standing', null, null], [51, 'Customers & WhatsApp', 'Chat rules', 'standing', null, null],
  [25, 'Adverts & marketing', 'WhatsApp adverts', 'recurring', null, 'daily'], [2, 'Adverts & marketing', 'Video adverts', 'recurring', null, 'daily'],
  [32, 'Adverts & marketing', 'Video adverts', 'standing', null, null], [33, 'Adverts & marketing', 'TV display', 'standing', null, null],
]
async function ensureCompanyLawsImpl() {
  await ensurePageLawsTable()
  await sql`ALTER TABLE page_laws
    ADD COLUMN IF NOT EXISTS category TEXT, ADD COLUMN IF NOT EXISTS subcategory TEXT, ADD COLUMN IF NOT EXISTS law_type TEXT NOT NULL DEFAULT 'standing',
    ADD COLUMN IF NOT EXISTS days TEXT, ADD COLUMN IF NOT EXISTS law_time TEXT, ADD COLUMN IF NOT EXISTS frequency TEXT, ADD COLUMN IF NOT EXISTS minutes INTEGER,
    ADD COLUMN IF NOT EXISTS dos TEXT, ADD COLUMN IF NOT EXISTS donts TEXT, ADD COLUMN IF NOT EXISTS sort_order INTEGER,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'live', ADD COLUMN IF NOT EXISTS tile_id INTEGER, ADD COLUMN IF NOT EXISTS seed TEXT, ADD COLUMN IF NOT EXISTS proof TEXT NOT NULL DEFAULT 'tick', ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 1`.catch(() => {})
  try {
    for (const [id, cat, sub, type, days, freq] of FIRST_SORT) {
      await sql`UPDATE page_laws SET category = ${cat}, subcategory = ${sub}, law_type = ${type}, days = ${days}, frequency = ${freq} WHERE id = ${id} AND category IS NULL`
    }
  } catch (e) { console.error('company laws first sort failed:', e instanceof Error ? e.message : String(e)) }
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS violations TEXT, ADD COLUMN IF NOT EXISTS not_violation TEXT`.catch(() => {})
  await seedAdvertsPilot() // after the first sort, so the existing daily advert laws are already marked recurring
  await seedCleanPilot()
  await (await import('./lawDraftsMore')).seedMoreLaws()
  await approveOnce('adverts-v1', 'The owner approved the whole Adverts set')
  await seedSanctionsLaw()
  await seedCashLaws()
  await seedFlagLaws()
  await approveOnce('flags-v1', 'The owner asked for the flag laws and checks')
  await approveOnce('flags-v2', 'The owner asked for one Fix flags law')
  await assignLawCodes()
  await seedViolationLines()
  // The owner approved the remaining sets in conversation.
  for (const seed of ['clean-v1', 'service-v1', 'customers-v1', 'display-v1', 'equipment-v1', 'stock-v1', 'staff-v1', 'security-v1', 'finance-v1']) await approveOnce(seed, 'The owner approved this set')
}
export const ensureCompanyLaws = once(ensureCompanyLawsImpl)

// The Adverts pilot: draft laws promoted from the old Standards (social media, adverts, TV), each with a schedule.
// Drafts are seen only by the owner and manager; approving them creates their checklist tiles. Added once.
type Draft = { cat: string; sub: string; type: 'recurring' | 'standing'; text: string; days?: string; freq?: string; time?: string; mins?: number; dos?: string; donts?: string }
const ADVERT_DRAFTS: Draft[] = [
  { cat: 'Adverts & marketing', sub: 'Video clips', type: 'recurring', freq: 'daily', time: '11:30', mins: 10, text: 'Record at least one video clip every day and save it in the Drive Video folder.', dos: 'Hold the phone upright on the tripod, facing the light\nKeep it 10 to 30 seconds, with the result in the first 3 seconds\nUse the clip-on mic if someone speaks\nFilm work, large format, neat goods, and customers (with permission)', donts: 'Do not film a customer\'s face, CV or document without permission' },
  { cat: 'Adverts & marketing', sub: 'Posting', type: 'recurring', freq: 'daily', time: '15:00', mins: 15, text: 'Edit the day\'s clip in CapCut and post it: TikTok first, then a Facebook Reel, then WhatsApp Status and the group.', dos: 'CapCut: Template, add clips, auto captions\nEnd the text with the company number (on the monitor sticker)\nExport, then post' },
  { cat: 'Adverts & marketing', sub: 'Posting', type: 'recurring', freq: 'daily', time: '15:30', mins: 5, text: 'The company phone posts the day\'s updates to the WhatsApp group and Channel. Draft captions and replies in the phone\'s own Claude chat.' },
  { cat: 'Adverts & marketing', sub: 'Posting', type: 'recurring', freq: 'daily', time: '16:00', mins: 5, text: 'Every staff member shares the day\'s post on their personal page.', dos: 'Facebook: Share to Feed, then Share to Story\nTikTok: Share, then Repost' },
  { cat: 'Adverts & marketing', sub: 'Ideas', type: 'recurring', freq: 'daily', time: '14:00', mins: 5, text: 'Try one new content idea each day.', dos: 'Banner printing out\nBefore and after typing\nCustomer collecting their work (with permission)\nAdmission reminders\nStickers being applied' },
  { cat: 'Adverts & marketing', sub: 'Replies', type: 'recurring', freq: 'daily', time: '17:00', mins: 10, text: 'Answer every comment and message on Facebook, TikTok and WhatsApp.' },
  { cat: 'Adverts & marketing', sub: 'Posting', type: 'recurring', freq: 'daily', time: '18:30', mins: 3, text: 'The social media lead confirms that today\'s posting and replies are done. Post more in busy seasons: WASSCE, admissions, reopening, church and funeral events.' },
  { cat: 'Adverts & marketing', sub: 'Posting', type: 'recurring', freq: 'weekly', days: 'mon', time: '10:00', mins: 30, text: 'Edit the week\'s clips in CapCut and schedule them in Meta Business Suite (Planner).' },
  { cat: 'Adverts & marketing', sub: 'TV display', type: 'recurring', freq: 'daily', time: '08:40', mins: 3, text: 'Check the 32-inch TV is on and playing the company advert on repeat, and the jingle is playing at the roadside.' },
  { cat: 'Adverts & marketing', sub: 'TV display', type: 'recurring', freq: 'weekly', days: 'fri', time: '15:00', mins: 20, text: 'Update the TV advert with new work or offers.' },
  { cat: 'Adverts & marketing', sub: 'Making adverts', type: 'recurring', freq: 'monthly', time: '10:00', mins: 60, text: 'Make or update an advert: a services advert (photocopy, printing, passport photos, large format, posters, banners, stickers) and a new jingle or voiceover, recorded in batches and saved to Drive and as /jingle.' },
  { cat: 'Adverts & marketing', sub: 'Posting', type: 'standing', text: 'No customer face, CV or document is posted without the customer\'s permission.' },
  { cat: 'Adverts & marketing', sub: 'Accounts', type: 'standing', text: 'Meta Business Suite runs on the company phone, logged in as Joe. Staff who post have task access only (content and messages). Every staff member\'s personal Facebook workplace is Grony Multimedia, and the company TikTok handle is in their bio.' },
  { cat: 'Security & privacy', sub: 'Accounts', type: 'standing', text: 'Company passwords, emails and recovery details are never changed by staff.' },
]
async function seedAdvertsPilot() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'adverts-v1'`
    if (n > 0) return
    // The two existing daily advert laws get the time and minutes that go with their schedule.
    await sql`UPDATE page_laws SET law_time = '11:30', minutes = 10 WHERE id = 2 AND law_time IS NULL AND law_type = 'recurring'`
    await sql`UPDATE page_laws SET law_time = '12:30', minutes = 10 WHERE id = 25 AND law_time IS NULL AND law_type = 'recurring'`
    await sql`UPDATE page_laws SET minutes = 15 WHERE id = 24 AND minutes IS NULL AND law_type = 'recurring'`
    for (const d of ADVERT_DRAFTS) {
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, status, seed)
        VALUES (${d.cat}, ${d.text}, false, 'law', ${d.cat}, ${d.sub}, ${d.type}, ${d.days ?? null}, ${d.time ?? null}, ${d.freq ?? null}, ${d.mins ?? null}, ${d.dos ?? null}, ${d.donts ?? null}, 'draft', 'adverts-v1')`
    }
  } catch (e) { console.error('adverts pilot seed failed:', e instanceof Error ? e.message : String(e)) }
}

// Cleans a law sent from the Company Laws screen (used by add and edit).
export function cleanLawBody(b: any, valid: { categories: string[]; types: string[]; days: string[]; freqs: string[] }) {
  const t = (v: unknown, n: number) => { const x = String(v ?? '').trim().slice(0, n); return x || null }
  const days = (Array.isArray(b.days) ? b.days : String(b.days ?? '').split(',')).map((d: unknown) => String(d).trim().toLowerCase()).filter((d: string) => valid.days.includes(d))
  const type = valid.types.includes(b.law_type) ? String(b.law_type) : 'standing'
  const mins = Math.round(Number(b.minutes))
  const recurring = type === 'recurring'
  return {
    text: String(b.text ?? '').trim().slice(0, 4000),
    category: valid.categories.includes(String(b.category ?? '')) ? String(b.category) : null,
    subcategory: t(b.subcategory, 60), law_type: type,
    days: recurring && days.length && days.length < 7 ? days.join(',') : null,
    law_time: recurring && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.law_time ?? '')) ? String(b.law_time) : null,
    frequency: recurring && valid.freqs.includes(String(b.frequency ?? '')) ? String(b.frequency) : null,
    minutes: recurring && Number.isFinite(mins) && mins > 0 && mins <= 240 ? mins : null,
    dos: t(b.dos, 1500), donts: t(b.donts, 1500),
    violations: parseViolations(b.violations), not_violation: t(b.not_violation, 500),
    proof: recurring && ['photo', 'question', 'persons'].includes(b.proof) ? String(b.proof) : 'tick',
    points: Number.isFinite(Math.round(Number(b.points))) && Math.round(Number(b.points)) >= 0 && Math.round(Number(b.points)) <= 20 ? Math.round(Number(b.points)) : 1,
  }
}

type Draft2 = Draft & { proof?: 'tick' | 'photo' }
const CLEAN_DRAFTS: Draft2[] = [
  { cat: 'Cleanliness & safety', sub: 'Daily cleaning', type: 'recurring', freq: 'daily', time: '08:45', mins: 5, proof: 'photo', text: 'Opening clean: floor mopped; printers, tables and showcases dusted with rag and brush. Take a photo of the clean shop.', dos: 'Mop the whole floor\nDust printers, tables and showcases with the rag and brush\nTake one clear photo of the floor and counter' },
  { cat: 'Cleanliness & safety', sub: 'Daily cleaning', type: 'recurring', freq: 'daily', time: '15:00', mins: 5, proof: 'photo', text: 'Afternoon cleanliness check: floor, counter, tables and toilets tidy. Take a photo and write anything that was dirty.' },
  { cat: 'Cleanliness & safety', sub: 'Daily cleaning', type: 'recurring', freq: 'daily', time: '09:10', mins: 3, text: 'Check the PRINTING PAPERS (A4, 4x6, 5x7) are stocked and clean: ream in its wrapper, upright and flat, nothing spilling.' },
  { cat: 'Cleanliness & safety', sub: 'Closing clean-up', type: 'recurring', freq: 'daily', time: '18:30', mins: 10, text: 'Closing clean-up: bins emptied, the WASTE PAPERS slot emptied, desks and printers cleared, and the laminator switched off, unplugged and cooled.', dos: 'BIN: rubbish and unusable paper only\nTear official and customer documents into pieces before they go in the BIN\nWASTE PAPERS slot: spoilt or unused test prints only\nClear papers off the desks and printers', donts: 'Do not leave the laminator on or near paper and the bin' },
  { cat: 'Cleanliness & safety', sub: 'Computers', type: 'recurring', freq: 'daily', time: '18:20', mins: 5, text: 'Clean both laptops: Desktop, Documents and Downloads emptied. Customer files go into the GM folders, everything else is deleted, and the Recycle Bin is emptied.' },
  { cat: 'Cleanliness & safety', sub: 'Weekly cleaning', type: 'recurring', freq: 'weekly', days: 'sat', time: '16:00', mins: 20, text: 'Wash the printer covers, and wipe the printers, laptops, scanner and showcases.' },
  { cat: 'Cleanliness & safety', sub: 'Fire safety', type: 'recurring', freq: 'daily', time: '08:50', mins: 3, text: 'Fire check: the extinguisher is in place and unblocked with the gauge in the green, and the gate and exits are clear.' },
  { cat: 'Cleanliness & safety', sub: 'Fire safety', type: 'recurring', freq: 'monthly', time: '10:30', mins: 5, text: 'Check the fire extinguisher\'s service date. It is serviced or refilled every year, and after any use.' },
  { cat: 'Cleanliness & safety', sub: 'Cables and power', type: 'recurring', freq: 'daily', time: '09:00', mins: 3, text: 'Cable check: no cable lies across any path or walkway, no extension board is plugged into another, and every cable is checked.', dos: 'Extension-board wires may pass under printers\nOne board per station, fixed off the floor, plugged straight into the wall\nBundle cables off the walkway', donts: 'Do not plug an extension board into another board' },
  { cat: 'Cleanliness & safety', sub: 'Front panel', type: 'standing', text: 'No eating or drinking at the front panel, and no food, water or bags on the front tables. Phones are charged only at the back, and bags, food and water are kept at the back.' },
  { cat: 'Cleanliness & safety', sub: 'Fire safety', type: 'standing', text: 'Everyone can use the extinguisher: Pull, Aim, Squeeze, Sweep. Switch off at the mains if it is safe. Never use water on an electrical fire. Fight a small fire only if there is a clear exit; otherwise everyone leaves and calls 192.', dos: 'Pull the pin\nAim at the base of the fire\nSqueeze the handle\nSweep side to side\nCall the Fire Service on 192', donts: 'Never use water on an electrical fire\nNever fight a fire with no clear exit' },
  { cat: 'Cleanliness & safety', sub: 'Fire safety', type: 'standing', text: 'The Fire Service number 192 and Joe\'s number are posted where everyone can see them.' },
]
async function seedCleanPilot() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'clean-v1'`
    if (n > 0) return
    await sql`UPDATE page_laws SET law_time = '10:00', minutes = 10, dos = COALESCE(dos, 'Tell everyone before the test\nHold the test button until it is loud\nNo sound: fit a new battery and test again\nStill faulty: report it to Joe') WHERE id = 57 AND law_time IS NULL`
    for (const d of CLEAN_DRAFTS) {
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, status, seed, proof)
        VALUES (${d.cat}, ${d.text}, false, 'law', ${d.cat}, ${d.sub}, ${d.type}, ${d.days ?? null}, ${d.time ?? null}, ${d.freq ?? null}, ${d.mins ?? null}, ${d.dos ?? null}, ${d.donts ?? null}, 'draft', 'clean-v1', ${d.proof ?? 'tick'})`
    }
  } catch (e) { console.error('cleanliness pilot seed failed:', e instanceof Error ? e.message : String(e)) }
}

// One-off approvals the owner has given in conversation (so the app does what was approved, once).
async function approveOnce(seed: string, _why: string) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES (${'approved:' + seed}) ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const { approveSeed } = await import('./lawTiles')
    await approveSeed(seed)
  } catch (e) { console.error('approve once failed:', e instanceof Error ? e.message : String(e)) }
}

async function seedSanctionsLaw() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'sanctions-v1'`
    if (n > 0) return
    await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, dos, status, seed, points)
      VALUES ('Staff management', ${'Sanctions: every violation of the Company Laws costs penalty points (each law shows its points; for now it is 1). Your points are always shown at the top of your profile. 20 points is a 3-day suspension with 10 hours deducted. 30 points is a 1-week suspension with 20 hours deducted. 50 points is dismissal. The owner approves every sanction. After a suspension your points drop to half the level. Points reduce by 5 after a clean record for a week. Everyone clocked in shares any checklist task left undone at the end of the day (at most 3 points a day each). The first two weeks are a learning period: violations are warnings and do not count.'},
              false, 'law', 'Staff management', 'Sanctions', 'standing', ${'20 points: 3-day suspension, 10 hours deducted\n30 points: 1-week suspension, 20 hours deducted\n50 points: dismissal\nA clean week: 5 points come off'}, 'live', 'sanctions-v1', 0)`
  } catch (e) { console.error('sanctions law seed failed:', e instanceof Error ? e.message : String(e)) }
}

// Laws for the Grony Cash pages that had none (Sales Log, Item 360, Losses and analytics). They start as drafts: the owner
// reads them on their tile and approves.
const CASH_DRAFTS: { sub: string; type: 'recurring' | 'standing'; text: string; freq?: string; days?: string; time?: string; mins?: number; dos?: string; donts?: string }[] = [
  { sub: 'Sales Log', type: 'recurring', freq: 'daily', time: '18:15', mins: 5, text: 'Check the Sales Log at closing: every sale of the day is there, the day\'s cash is counted and matches the log, and any difference is written down and told to Joe before leaving.', dos: 'Open the Sales Log and the day\'s receipts\nCount the cash and compare\nWrite down any difference and tell Joe' },
  { sub: 'Sales Log', type: 'standing', text: 'A wrong tap is undone in the Sales Log the same day. A sale is never deleted or hidden to make a figure match.', dos: 'Undo the tap and enter the right sale\nTell Joe if the day is already closed', donts: 'Delete a sale to hide a difference' },
  { sub: 'Sales Log', type: 'standing', text: 'A customer\'s receipt comes from the Sales Log or MI. It is never retyped or rewritten.' },
  { sub: 'Item 360', type: 'standing', text: 'When an item shows a loss, negative stock or a wrong price, open Item 360 and find the cause (a bill, count, sale or edit) before changing anything.', dos: 'Read the item\'s history\nFix the record that caused it\nTell Joe if you cannot find the cause' },
  { sub: 'Item 360', type: 'standing', text: 'Item details are changed only to fix a real mistake, never to hide a loss or make a count match.' },
  { sub: 'Losses and analytics', type: 'recurring', freq: 'weekly', days: 'mon', time: '10:00', mins: 15, text: 'Review Loss by Date and Loss by Items. Any item with repeated losses is counted again and the likely cause is written down for Joe.', dos: 'Open Losses, then Loss by Items\nCount the worst items again\nWrite the likely cause' },
  { sub: 'Losses and analytics', type: 'standing', text: 'Items that have not sold for a long time (Goods: Longest Unbought) are reported to Joe so they are not reordered by mistake.' },
]
async function seedCashLaws() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'cash-v1'`
    if (n > 0) return
    for (const d of CASH_DRAFTS) {
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, status, seed)
        VALUES ('Stock & records', ${d.text}, false, 'law', 'Stock & records', ${d.sub}, ${d.type}, ${d.days ?? null}, ${d.time ?? null}, ${d.freq ?? null}, ${d.mins ?? null}, ${d.dos ?? null}, ${d.donts ?? null}, 'draft', 'cash-v1')`
    }
  } catch (e) { console.error('cash laws seed failed:', e instanceof Error ? e.message : String(e)) }
}

// Every law on a tile that has a code prefix gets a short code (LS-1, LS-2...) the first time it is seen. A code never
// changes afterwards, so staff, videos and sanctions can all refer to it.
const CODED_AREAS: { prefix: string; cat: string; subs: string[] }[] = [
  { prefix: 'LS', cat: 'Stock & records', subs: ['Item list', 'Prices', 'Recording', 'Know the words', 'Flags'] },
]
async function assignLawCodes() {
  try {
    await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS code TEXT`
    for (const a of CODED_AREAS) {
      const rows = await sql`SELECT id, code FROM page_laws WHERE category = ${a.cat} AND subcategory = ANY(${a.subs}) ORDER BY id`
      let max = 0
      for (const r of rows) { const m = String(r.code ?? '').match(/-(\d+)$/); if (m) max = Math.max(max, Number(m[1])) }
      for (const r of rows) if (!r.code) await sql`UPDATE page_laws SET code = ${a.prefix + '-' + ++max} WHERE id = ${r.id} AND code IS NULL`
    }
  } catch (e) { console.error('law codes failed:', e instanceof Error ? e.message : String(e)) }
}

// Flags on Live Sale: the law that every flag is fixed as soon as it appears, and three daily checks that put the flags on the
// Daily Checklist. They go live straight away (the owner asked for them).
const FLAG_NAMES = 'No Selling Price, No Cost Price, No Group, Empty Row, Duplicate Items, Unlinked Sales, Service Violations, Unknown Quantity, GMC Pack Overage, Net Gain, Needs Review, Alias Needs Check, Ledger Notes, Negative Stock and the old alias checks'
const FLAG_LAWS: { type: 'recurring' | 'standing'; text: string; time?: string; mins?: number; dos?: string; donts?: string; points?: number }[] = [
  { type: 'recurring', time: '09:30', mins: 10, points: 2, text: 'Fix flags: every flag on Live Sale is fixed as soon as it appears. Open 🚩 Flags and fix what is open now. A flag is never left for the next day and never hidden by editing an item just to make it disappear. Flags: ' + FLAG_NAMES + '.',
    dos: 'Open Items / Live Sale\nTap 🚩 Flags and open each flag\nFix it using the how-to for that flag\nA flag you cannot fix: tell Joe now', donts: 'Leave a flag open overnight\nEdit an item just to clear a flag' },
]
async function seedFlagLaws() {
  try {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = 'flags-v2'`
    if (n > 0) return
    // The four flag laws first made are replaced by this one law (and their checklist tiles stopped).
    const old = await sql`SELECT id FROM page_laws WHERE seed = 'flags-v1'` as unknown as { id: number }[]
    if (old.length) {
      await sql`DELETE FROM page_laws WHERE seed = 'flags-v1'`
      const { syncLawTile } = await import('./lawTiles')
      for (const r of old) await syncLawTile(r.id).catch(() => {})
    }
    for (const d of FLAG_LAWS) {
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, frequency, law_time, minutes, dos, donts, status, seed, proof, points)
        VALUES ('Stock & records', ${d.text}, false, 'law', 'Stock & records', 'Flags', ${d.type}, ${d.type === 'recurring' ? 'daily' : null}, ${d.time ?? null}, ${d.mins ?? null}, ${d.dos ?? null}, ${d.donts ?? null}, 'draft', 'flags-v2', ${d.type === 'recurring' ? 'question' : 'tick'}, ${d.points ?? 1})`
    }
  } catch (e) { console.error('flag laws seed failed:', e instanceof Error ? e.message : String(e)) }
}

// The first violation lines, written once for the laws of the Grony Cash pages (the owner edits them from the law). A law whose text
// is not recognised is left empty for the owner to fill in.
const V = (text: string, points = 1) => ({ text, points, by: 'manager' as const })
const VIOLATION_RULES: { re: RegExp; v: ReturnType<typeof V>[]; not?: string }[] = [
  { re: /Every walk-in sale goes in Live Sale/i, v: [V('A sale is not recorded in Live Sale as soon as it happens'), V('Shop use is recorded as a sale (WIC), or a customer sale is recorded as GMC'), V('A customer is not given a receipt for a sale'), V('Several items for one customer are recorded as separate sales and not through MI'), V('A new item is created without first searching for an existing one')], not: 'Shop use recorded with the GMC button. A sale recorded a little late because the customer was still choosing.' },
  { re: /Past days are entered only/i, v: [V('A past day is entered without + Past sale, or with the wrong sale date'), V('The same sale or work is typed twice')] },
  { re: /Receipts are issued from MI/i, v: [V('A receipt is typed by hand into Customer Receipts'), V('A sale the app refused is forced through instead of telling Joe')] },
  { re: /Item groups checked/i, v: [V('The weekly item group check is not done on its day'), V('An item is left in the wrong group, or in no group, after the check')] },
  { re: /price list is current/i, v: [V('The monthly price check is not done'), V('An old price is sold after the price list was updated')] },
  { re: /App words/i, v: [V('An entry is made with the wrong term, for example shop use recorded as a sale')] },
  { re: /^Fix flags/i, v: [V('A flag is left open overnight', 2), V('An item is edited only to make a flag disappear', 2), V('A flag that cannot be fixed is not reported to Joe')] },
  { re: /Check the Sales Log at closing/i, v: [V('The closing Sales Log check is not done'), V('A cash difference is not written down and told to Joe before leaving')] },
  { re: /wrong tap is undone in the Sales Log/i, v: [V('A wrong tap is left uncorrected overnight'), V('A sale is deleted or hidden to make a figure match', 3)] },
  { re: /receipt comes from the Sales Log or MI/i, v: [V('A customer receipt is retyped or rewritten')] },
  { re: /open Item 360 and find the cause/i, v: [V('An item is edited to change a loss, negative stock or price before its cause is found')] },
  { re: /changed only to fix a real mistake/i, v: [V('An item is edited to hide a loss or make a count match', 3)] },
  { re: /Review Loss by Date/i, v: [V('The weekly loss review is not done'), V('An item with repeated losses is not counted again and its cause not written')] },
  { re: /not sold for a long time|Longest Unbought/i, v: [V('A long-unsold item is reordered without telling Joe')] },
]
async function seedViolationLines() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('violations-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, text FROM page_laws WHERE (violations IS NULL OR violations = '') AND category = 'Stock & records'` as unknown as { id: number; text: string }[]
    for (const r of rows) {
      const rule = VIOLATION_RULES.find(x => x.re.test(r.text))
      if (rule) await sql`UPDATE page_laws SET violations = ${JSON.stringify(rule.v)}, not_violation = ${rule.not ?? null} WHERE id = ${r.id}`
    }
  } catch (e) { console.error('violation lines seed failed:', e instanceof Error ? e.message : String(e)) }
}
