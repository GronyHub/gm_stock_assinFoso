import { seedDone } from '@/lib/seedGuard'
import { mergeCustomerServiceCode } from '@/lib/csMerge'
import { fillLawGapsOnce } from '@/lib/lawGaps'
import { fillQuizzesOnce } from '@/lib/lawQuizGen'
import { betterQuizzesOnce } from '@/lib/lawQuizKey'
import { seedMetaLaws, seedMetaJoe, seedRules } from '@/lib/metaLaws'
import sql from '@/lib/db'
import { cleanAssignment } from '@/lib/assignment'
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
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS assignment TEXT NOT NULL DEFAULT 'all'`.catch(() => {})
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS month_day INTEGER`.catch(() => {})
  await assignmentFromAudienceOnce()
  await mapOpeningClosingOnce()
  await mapRemainingTilesOnce()
  await rotaAndTodoLawsOnce()
  await pendingJobsLawsOnce()
  await absenceLawOnce()
  await dedupeLawsOnce()
  await (await import('./auditFixes')).auditFixesOnce()
  await (await import('./conflictFixes')).conflictFixesOnce()
  await (await import('./conflictFixes')).flagsLawOnce()
  await (await import('./conflictFixes')).countsLawOnce()
  await (await import('./renameLive')).renameLiveOnce()
  await pendingJobsConfirmOnce()
  await cashCountedLawOnce()
  await (await import('./questionGroups')).seedQuestionGroupsOnce()
  try {
    for (const [id, cat, sub, type, days, freq] of FIRST_SORT) {
      await sql`UPDATE page_laws SET category = ${cat}, subcategory = ${sub}, law_type = ${type}, days = ${days}, frequency = ${freq} WHERE id = ${id} AND category IS NULL`
    }
  } catch (e) { console.error('company laws first sort failed:', e instanceof Error ? e.message : String(e)) }
  await sql`ALTER TABLE page_laws ADD COLUMN IF NOT EXISTS violations TEXT, ADD COLUMN IF NOT EXISTS not_violation TEXT, ADD COLUMN IF NOT EXISTS title TEXT, ADD COLUMN IF NOT EXISTS quiz TEXT, ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'staff', ADD COLUMN IF NOT EXISTS reminder TEXT NOT NULL DEFAULT 'none'`.catch(() => {})
  await seedAdvertsPilot() // after the first sort, so the existing daily advert laws are already marked recurring
  await seedCleanPilot()
  await (await import('./lawDraftsMore')).seedMoreLaws()
  await approveOnce('adverts-v1', 'The owner approved the whole Adverts set')
  await seedSanctionsLaw()
  await seedAttendanceLaw()
  await seedCashLaws()
  await seedFlagLaws()
  await approveOnce('flags-v1', 'The owner asked for the flag laws and checks')
  await approveOnce('flags-v2', 'The owner asked for one Fix flags law')
  await assignLawCodes()
  await seedViolationLines()
  await scopeItemsLaws()
  await splitMultiViolationLaws()
  await seedUnderstandingLaws()
  await sharpenItemsLaws()
  await managersOnlyFlags()
  await seedReminders()
  await seedMetaLaws()
  await seedMetaJoe()
  await seedRules()
  await mergeCustomerServiceCode()
  await approveAllDraftsOnce()
  await fillLawGapsOnce()
  await fillQuizzesOnce()
  await betterQuizzesOnce()
  await assignLawCodes()
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
    if (await seedDone('adverts-v1')) return
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
    violations: parseViolations(b.violations), not_violation: t(b.not_violation, 500), title: t(b.title, 80), audience: b.audience === 'managers' ? 'managers' : 'staff', reminder: ['login', 'first_sale'].includes(b.reminder) ? String(b.reminder) : 'none',
    proof: recurring && ['photo', 'question', 'persons'].includes(b.proof) ? String(b.proof) : 'tick',
    assignment: cleanAssignment(b.assignment),
    // monthly laws: the day of the month it is done on (1 to 31; a short month uses its last day)
    month_day: recurring && String(b.frequency ?? '') === 'monthly' && Number.isInteger(Number(b.month_day)) && Number(b.month_day) >= 1 && Number(b.month_day) <= 31 ? Number(b.month_day) : null,
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
    if (await seedDone('clean-v1')) return
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

// The owner approved every draft law in conversation (2026-11-10). Done once, through the normal approval path (checklist tiles are made, old tiles retired).
// The newly live laws start their signing clock 3 days from now, so nobody is penalised for not signing dozens of laws overnight.
async function approveAllDraftsOnce() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('approve-all-drafts-2026-11-10') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const { approveDrafts } = await import('./lawTiles')
    const drafts = await sql`SELECT id, category FROM page_laws WHERE status = 'draft'` as unknown as { id: number; category: string | null }[]
    for (const cat of Array.from(new Set(drafts.map(d => d.category).filter(Boolean) as string[]))) await approveDrafts({ category: cat })
    for (const d of drafts.filter(x => !x.category)) await approveDrafts({ id: d.id })
    const ids = drafts.map(d => d.id)
    if (ids.length) await sql`UPDATE page_laws SET live_at = now() + interval '3 days' WHERE id = ANY(${ids}) AND status = 'live'`
  } catch (e) { console.error('approve all drafts failed:', e instanceof Error ? e.message : String(e)) }
}

// The Opening and Closing checklist tiles made from the old Standards list all duplicated a law that already has its own tile. The old
// tiles are switched off (records kept), the laws get their "Who does it", and two standing laws gain the sentence their old tile carried.
// The owner approved this mapping in conversation (2026-11-12). Done once.
async function mapOpeningClosingOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('map-opening-closing-2026-11-12') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE daily_check_tiles SET active = false WHERE law_id IS NULL AND active AND section IN ('Opening', 'Closing') AND kind = 'tap'
      AND id IN (6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 76, 77, 78, 80, 81, 82)`
    await sql`UPDATE daily_check_tiles SET law_id = 111 WHERE id = 1 AND law_id IS NULL AND kind = 'properties' AND EXISTS (SELECT 1 FROM page_laws WHERE id = 111)`
    const sets: [string, number[]][] = [['opener', [76, 110, 56, 111, 112, 113, 46, 70, 82, 133]], ['managers', [139]], ['closer', [80, 102, 79, 114, 142, 134]]]
    for (const [a, ids] of sets) {
      await sql`UPDATE page_laws SET assignment = ${a} WHERE id = ANY(${ids})`
      await sql`UPDATE daily_check_tiles SET assignment = ${a} WHERE law_id = ANY(${ids})`
    }
    // A changed wording changes the law's hash, so everyone is asked to sign it again; the clock for that starts now.
    await sql`UPDATE page_laws SET text = text || ' A staff member''s own phone charges only at the back of the shop.', live_at = now()
      WHERE id = 85 AND text NOT ILIKE '%phone charges only at the back%'`
    await sql`UPDATE page_laws SET text = text || ' Laptop wallpapers are solid black.', live_at = now()
      WHERE id = 145 AND text NOT ILIKE '%wallpapers are solid black%'`
  } catch (e) { console.error('opening/closing mapping failed:', e instanceof Error ? e.message : String(e)) }
}

// The rest of the old Standards-list tiles (Daytime, Stations, Grony 2, Weekly, Equipment, Monthly) were checked against the laws on 2026-11-12:
// none had ever been ticked, and each one either repeated a law that already exists (and often already has its own tile) or was a one-time
// setup step. They are switched off (their history is kept). Three new laws take what had no home: station supplies, the monthly inventory
// (its 57 lines stay as its steps) and the weekly property marking. The approved-apps lists move into law 143. The owner approved this in
// conversation. Done once.
async function mapRemainingTilesOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('map-remaining-tiles-2026-11-12') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const { syncLawTile } = await import('./lawTiles')
    const mk = async (o: { title: string; text: string; sub: string; cat: string; type: 'standing' | 'recurring'; freq?: string; time?: string; mins?: number; assignment: string; violation: string }) => {
      const [r] = await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, frequency, law_time, minutes, status, seed, proof, points, violations, title, assignment, live_at)
        VALUES (${o.cat}, ${o.text}, false, 'law', ${o.cat}, ${o.sub}, ${o.type}, ${o.freq ?? null}, ${o.time ?? null}, ${o.mins ?? null}, 'live', 'map-remaining-v1', 'tick', 1,
                ${JSON.stringify([{ text: o.violation, points: 1, by: 'manager' }])}, ${o.title}, ${o.assignment}, now() + interval '3 days') RETURNING id`
      if (o.type === 'recurring') await syncLawTile(r.id as number).catch(() => {})
      return r.id as number
    }
    await mk({ cat: 'Cleanliness & safety', sub: 'Work stations', type: 'standing', assignment: 'all', title: 'Keep each work station stocked and tidy',
      text: 'Keep each work station stocked and tidy. A permanent marker is present and chargers are wrapped with rubber bands. Staplers, cutters, tapes, pens and scissors go back in their place after use. Nothing rests on printer lids or tops. Everything needed for printing is within reach, and anything missing is reported to Joe. The showcase list is complete. A faulty machine or item goes on the lower shelf of the Boys\' showcase with a note (item, fault, date, name). The shop\'s WhatsApp QR sticker is on the back of the monitor, flat, clean and facing customers, and a customer who asks where to send work is shown it. Any setting or location you might forget is labelled, and any new procedure that works is written down.',
      violation: 'A work station is left without its supplies in place, or untidy' })
    const inv = await mk({ cat: 'Stock & records', sub: 'Monthly inventory', type: 'recurring', freq: 'monthly', time: '16:00', mins: 60, assignment: 'managers', title: 'Monthly shop inventory',
      text: 'Once a month, check the shop inventory: every item on the inventory list is present, in its place and in the quantity written. Missing or damaged items are reported to the owner.',
      violation: 'The monthly inventory is not completed on its day' })
    const prop = await mk({ cat: 'Equipment, power & repairs', sub: 'Properties', type: 'recurring', freq: 'weekly', time: '15:30', mins: 15, assignment: 'all', title: 'Mark the shop properties every week',
      text: 'Once a week, mark every property at the shop (printers, computers and screens, cameras and lights, sound equipment) as present and working, in the app.',
      violation: 'The weekly property marking is not done on its day' })
    // the old tiles that are steps of the new laws
    await sql`UPDATE daily_check_tiles SET law_id = ${inv} WHERE law_id IS NULL AND active AND section = 'Monthly' AND id BETWEEN 139 AND 195`
    await sql`UPDATE daily_check_tiles SET law_id = ${prop} WHERE active AND id IN (1, 2, 3, 4) AND kind = 'properties'`
    // the approved-apps lists move into law 143, so the list is not lost
    const apps = await sql`SELECT title FROM daily_check_tiles WHERE id BETWEEN 107 AND 118 AND law_id IS NULL ORDER BY id` as unknown as { title: string }[]
    if (apps.length) await sql`UPDATE page_laws SET dos = COALESCE(dos, '') || ${'\n\nApproved apps:\n' + apps.map(a => a.title).join('\n')} WHERE id = 143 AND COALESCE(dos, '') NOT LIKE '%Approved apps:%'`
    const ids: number[] = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 56]
    for (let i = 57; i <= 64; i++) ids.push(i)
    for (let i = 84; i <= 127; i++) ids.push(i)
    for (let i = 128; i <= 138; i++) ids.push(i)
    for (let i = 196; i <= 254; i++) ids.push(i)
    await sql`UPDATE daily_check_tiles SET active = false WHERE law_id IS NULL AND active AND kind = 'tap' AND id = ANY(${ids})`
  } catch (e) { console.error('remaining tiles mapping failed:', e instanceof Error ? e.message : String(e)) }
}

// Laws the rota and the future to-do list stand on (the owner's rule: everything rests on a law). Created once; the weekly law
// "The team rota for the week is set and everyone knows it" already existed.
async function rotaAndTodoLawsOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('rota-todo-laws-2026-11-12') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const mk = async (title: string, sub: string, text: string, violation: string, by: 'manager' | 'app' = 'manager') => {
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, assignment, live_at)
        VALUES ('Staff management', ${text}, false, 'law', 'Staff management', ${sub}, 'standing', 'live', 'todo-rota-v1', 'tick', 1,
                ${JSON.stringify([{ text: violation, points: 1, by }])}, ${title}, 'all', now() + interval '3 days')`
    }
    await mk('Work the shifts on the rota', 'Rota', 'Work the shifts the rota gives you, and arrive at your scheduled time. If you cannot work a shift, tell Joe as early as you can so it can be covered.', 'A shift on the rota is not worked and Joe was not told in time')
    await mk('The Opener and the Closer come from the rota', 'Rota', 'The Opener and the Closer of the day are the people the rota names for it. If the rota does not name them, the Opener is the first to clock in and the Closer is the last to clock out. A task given to the Opener or the Closer is theirs, and if it is left undone at the end of the day the point is theirs.', 'A task given to the Opener or the Closer is left undone at the end of the day', 'app')
    await mk('Do the to-do items you are given by their date', 'To do', 'A to-do item added in To do for a date, to you or to everyone, is done by that date. Joe and the owner add them.', 'A to-do item given to you is not done by its date')
  } catch (e) { console.error('rota/to-do laws failed:', e instanceof Error ? e.message : String(e)) }
}

// Pending jobs (the jobs customers leave behind) rest on two laws: one to write every job down, and a daily one that puts the list in front of
// everyone in To do. Created once.
async function pendingJobsLawsOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('pending-jobs-laws-2026-11-12') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const { syncLawTile } = await import('./lawTiles')
    await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, assignment, live_at)
      VALUES ('Customer service', ${'Every job a customer leaves with us is written in Pending jobs at once: the customer, their phone, what was left and the date promised. When the job is done, mark it ready and call the customer. When it is collected, mark it handed over.'}, false, 'law', 'Customer service', 'Pending jobs', 'standing', 'live', 'pending-jobs-v1', 'tick', 1,
              ${JSON.stringify([{ text: 'A job a customer left is not written in Pending jobs', points: 1, by: 'manager' }])}, 'Write down every job a customer leaves', 'all', now() + interval '3 days')`
    const [r] = await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, frequency, law_time, minutes, status, seed, proof, points, violations, title, assignment, live_at)
      VALUES ('Customer service', ${'Go through the pending jobs: finish what is due, and call every customer whose job is ready or overdue.'}, false, 'law', 'Customer service', 'Pending jobs', 'recurring', 'daily', '11:00', 10, 'live', 'pending-jobs-v1', 'tick', 1,
              ${JSON.stringify([{ text: 'The pending jobs are not gone through on the day', points: 1, by: 'manager' }])}, 'Go through the pending jobs', 'all', now() + interval '3 days') RETURNING id`
    await syncLawTile(r.id as number).catch(() => {})
  } catch (e) { console.error('pending jobs laws failed:', e instanceof Error ? e.message : String(e)) }
}

// Planned absences are reported in the app at least a day before (the rota and the Opener and Closer depend on it). Created once; the standing law
// "Inform ... if you will not be at work or will not be at work on time" covers what happens on the day itself.
async function absenceLawOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('absence-law-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, assignment, live_at)
      VALUES ('Staff management', ${'Report a planned absence in the app (Times, the report absence icon) at least one day before it, with the reason. If something happens on the day itself, tell Joe straight away.'}, false, 'law', 'Staff management', 'Attendance', 'standing', 'live', 'absence-v1', 'tick', 1,
              ${JSON.stringify([{ text: 'A planned absence is not reported in the app at least a day before', points: 1, by: 'manager' }])}, 'Report a planned absence a day before', 'all', now() + interval '3 days')`
  } catch (e) { console.error('absence law failed:', e instanceof Error ? e.message : String(e)) }
}

// The owner asked (2026-11-13) for the duplicate laws and tasks found in the audit to be fixed. A duplicate law is removed with its signatures; its task is switched off (kept for history).
async function dedupeLawsOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('dedupe-laws-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const drop = async (title: string) => {
      const rows = await sql`SELECT id FROM page_laws WHERE title = ${title}` as unknown as { id: number }[]
      for (const r of rows) {
        await sql`UPDATE daily_check_tiles SET active = FALSE, law_id = NULL WHERE law_id = ${r.id}`.catch(() => {})
        await sql`DELETE FROM law_signatures WHERE law_id = ${r.id}`.catch(() => {})
        await sql`DELETE FROM page_laws WHERE id = ${r.id}`
      }
    }
    await drop("Every printer's letter sticker matches its name on the screen")   // same rule as "Every printer stays on power and USB, and its letter matches its name on screen"
    await drop('Team behaviour')                                                   // the end-of-day check is the one that counts
    await drop('Sales Log checked')                                                // merged into "Check the Sales Log at closing"
    await sql`UPDATE daily_check_tiles SET title = title || ' Every row shows its customer; missing ones are added.' WHERE title LIKE 'Check the Sales Log at closing:%' AND title NOT LIKE '%shows its customer%'`.catch(() => {})
    // "Mark printers" is one item of the weekly property marking, not a separate timed task.
    await sql`UPDATE daily_check_tiles SET time = NULL WHERE title = 'Mark printers' AND law_id IN (SELECT id FROM page_laws WHERE title = 'Mark the shop properties every week')`.catch(() => {})
  } catch (e) { console.error('dedupe laws failed:', e instanceof Error ? e.message : String(e)) }
}

// The pending-jobs round is only asked for while there are open pending jobs, and asks staff to confirm they are working on them (2026-11-13).
async function pendingJobsConfirmOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('pending-jobs-confirm-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const { ensureTileCondition } = await import('./dailyChecks')
    await ensureTileCondition()
    const text = 'Pending jobs: confirm you have gone through every open pending job and are working on them. Finish what is due, and call every customer whose job is ready or overdue.'
    const laws = await sql`UPDATE page_laws SET text = ${text} WHERE seed = 'pending-jobs-v1' AND title = 'Go through the pending jobs' RETURNING id`
    const { syncLawTile } = await import('./lawTiles')
    for (const l of laws) await syncLawTile(l.id as number).catch(() => {})
    await sql`UPDATE daily_check_tiles SET condition = 'pending_jobs' WHERE law_id = ANY(${laws.map(l => l.id)})`
  } catch (e) { console.error('pending jobs confirm failed:', e instanceof Error ? e.message : String(e)) }
}

// The owner's new law (2026-11-13): the manager enters the previous day's Cash Counted before 09:00. A recurring task for the manager, so it has a time, a tile and a point.
async function cashCountedLawOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('cash-counted-law-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const { syncLawTile } = await import('./lawTiles')
    const text = "The manager or owner enters the previous day's Cash Counted every day before 09:00. Cash Counted includes all cash received for the day, whether from MoMo, debtors, part payments or other sources. It is entered by the manager or owner because they hold the finances of the business."
    const violations = [{ text: "Yesterday's Cash Counted is not entered by 09:00", points: 1, by: 'manager', record: 'Logged against the manager in Penalty Points', how: "Open the Sales Log and enter yesterday's Cash Counted before doing anything else" }]
    const [r] = await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, frequency, law_time, minutes, status, seed, proof, points, violations, title, assignment, audience, dos, donts, live_at)
      VALUES ('Finance', ${text}, false, 'law', 'Finance', 'Sales Log', 'recurring', 'daily', '09:00', 5, 'live', 'cash-counted-v1', 'tick', 1, ${JSON.stringify(violations)}, 'Enter Cash Counted', 'managers', 'managers',
              ${'Complete the CCTV review first, to be sure every sale was recorded.'}, ${"Do not log in or carry on with the day's work without entering the previous day's Cash Counted."}, now()) RETURNING id`
    await syncLawTile(r.id as number).catch(() => {})
  } catch (e) { console.error('cash counted law failed:', e instanceof Error ? e.message : String(e)) }
}

// The new "Who does it" column starts from what the law already said: a managers' law is done by the managers. Once.
async function assignmentFromAudienceOnce() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('assignment-from-audience-2026-11-12') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE page_laws SET assignment = 'managers' WHERE audience = 'managers' AND assignment = 'all'`
    await sql`UPDATE daily_check_tiles SET assignment = 'managers' WHERE law_id IN (SELECT id FROM page_laws WHERE assignment = 'managers')`.catch(() => {})
  } catch (e) { console.error('assignment migration failed:', e instanceof Error ? e.message : String(e)) }
}

async function seedAttendanceLaw() {
  try {
    if (await seedDone('attendance-v1')) return
    const violations = [
      { text: 'Late for the rostered start (more than 10 minutes) without telling the shop in the app first', points: 1, by: 'staff', record: 'Added automatically at day end from the rota and the clock', how: 'Open Times and tell the shop you will be late, with the time you expect to arrive, before you arrive.' },
      { text: 'Absent on a rostered day without telling the shop in the app first', points: 2, by: 'staff', record: 'Added automatically at day end from the rota and the clock', how: 'Open Times and report the absence before your shift starts.' },
    ]
    await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, dos, donts, status, seed, points, violations, title)
      VALUES ('Staff management', ${'Lateness and absence: if you will be late or absent, tell the shop in the app (Times) before you arrive late or before your shift starts. Late without telling costs 1 penalty point. Absent without notice costs 2 penalty points. Telling the shop in time costs nothing.'},
              false, 'law', 'Staff management', 'Attendance', 'standing', ${'Report lateness in Times with the time you expect to arrive\nReport an absence before your shift starts'}, ${'Arrive late or stay away without telling the shop'}, 'live', 'attendance-v1', 1, ${JSON.stringify(violations)}, 'Tell the shop if you are late or absent')`
  } catch (e) { console.error('attendance law seed failed:', e instanceof Error ? e.message : String(e)) }
}

async function seedSanctionsLaw() {
  try {
    if (await seedDone('sanctions-v1')) return
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
    if (await seedDone('cash-v1')) return
    for (const d of CASH_DRAFTS) {
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, days, law_time, frequency, minutes, dos, donts, status, seed)
        VALUES ('Stock & records', ${d.text}, false, 'law', 'Stock & records', ${d.sub}, ${d.type}, ${d.days ?? null}, ${d.time ?? null}, ${d.freq ?? null}, ${d.mins ?? null}, ${d.dos ?? null}, ${d.donts ?? null}, 'draft', 'cash-v1')`
    }
  } catch (e) { console.error('cash laws seed failed:', e instanceof Error ? e.message : String(e)) }
}

// Every law on a tile that has a code prefix gets a short code (LS-1, LS-2...) the first time it is seen. A code never
// changes afterwards, so staff, videos and sanctions can all refer to it.
const CODED_AREAS: { prefix: string; cat: string; subs: string[] }[] = [
  { prefix: 'LS', cat: 'Stock & records', subs: ['Item list', 'Prices', 'Recording', 'Know the words', 'Flags', 'Understanding'] },
  { prefix: 'SL', cat: 'Stock & records', subs: ['Sales Log'] },
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
  { type: 'recurring', time: '09:30', mins: 10, points: 2, text: 'Fix flags: every flag on Live is fixed as soon as it appears. Open 🚩 Flags and fix what is open now. A flag is never left for the next day and never hidden by editing an item just to make it disappear. Flags: ' + FLAG_NAMES + '.',
    dos: 'Open Live\nTap 🚩 Flags and open each flag\nFix it using the how-to for that flag\nA flag you cannot fix: tell Joe now', donts: 'Leave a flag open overnight\nEdit an item just to clear a flag' },
]
async function seedFlagLaws() {
  try {
    if (await seedDone('flags-v2')) return
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
type VL = { text: string; points: number; by: 'manager' | 'app'; how?: string; chapter?: string }
const V = (text: string, how?: string, chapter?: string, points = 1): VL => ({ text, points, by: 'manager', ...(how ? { how } : {}), ...(chapter ? { chapter } : {}) })
const REC = 'Find the item in Search\nCheck the quantity and the price on its card\nSay who it is for: a GM number, phone, name or label\nTap the red tick. The sale goes into the Sales Log'
const VIOLATION_RULES: { re: RegExp; title: string; v: VL[]; not?: string }[] = [
  { re: /Every walk-in sale goes in Live/i, title: 'Record every sale as soon as it happens', not: 'Shop use recorded with the GMC button. A sale recorded a little late because the customer was still choosing.', v: [
    V('A sale is not recorded in Live as soon as it happens', REC, 'Find the item|Search the item'),
    V('Shop use is recorded as a sale (WIC), or a customer sale is recorded as GMC', 'Keep the switch on WIC for a sale to a customer\nUse GMC only for things the shop uses itself, never for a sale', 'WIC'),
    V('A customer is not given a receipt for a sale', 'Issue the receipt from MI, or find the sale in the Sales Log and give it to the customer\nNever type a receipt by hand', 'several items|Sales Log'),
    V('Several items for one customer are recorded as separate sales and not through MI', 'Tap MI\nAdd each item to the basket\nPick the customer\nIssue one receipt for everything', 'several items'),
    V('A new item is created without first searching for an existing one', 'Type the item name in Search first\nCreate a new item only if nothing matches', 'Find the item|Search the item')] },
  { re: /Past days are entered only/i, title: 'Enter past days correctly', v: [
    V('A past day is entered without + Past sale, or with the wrong sale date', 'Tap + Past sale\nChoose the right sale date\nEnter the sale once', 'Past days|Past sale'),
    V('The same sale or work is typed twice', 'Check the Sales Log before entering a sale for a day that was already worked', 'Past days|Past sale')] },
  { re: /Receipts are issued from MI/i, title: 'Issue receipts properly', v: [
    V('A receipt is typed by hand into Customer Receipts', 'Issue the receipt from MI, or from the Sales Log', 'Wrong sale|Undo|Sales Log'),
    V('A sale the app refused is forced through instead of telling Joe', 'If the app refuses a sale, such as a price below cost or not enough stock, do not force it\nTell Joe', 'Wrong sale|Undo|Sales Log')] },
  { re: /Item groups checked/i, title: 'Keep every item in the right group', v: [
    V('The weekly item group check is not done on its day', 'Open the Flags dropdown and look at No Group\nOpen each item, tap Edit, pick the right group, tap Save', 'right group|Item groups'),
    V('An item is left in the wrong group, or in no group, after the check', 'Open the item, tap Edit, pick the right group, tap Save', 'right group|Item groups')] },
  { re: /price list is current/i, title: 'Keep the price list current', v: [
    V('The monthly price check is not done', 'Compare the price list with the prices on the cards\nCorrect a price: open the item, tap Edit, type the price, tap Save', 'current price|Prices'),
    V('An old price is sold after the price list was updated', 'Check the price on the card before tapping the tick', 'current price|Prices')] },
  { re: /App words/i, title: 'Use the app words correctly', v: [
    V('An entry is made with the wrong term, for example shop use recorded as a sale', 'SOH is stock on hand\nSP is selling price, CP is cost price\nWIC is a walk-in customer sale, GMC is shop use\nCAB is cash at bank', 'words')] },
  { re: /^Fix flags/i, title: 'Fix flags as soon as they appear', v: [
    V('A flag is left open overnight', 'Open Live, tap 🚩 Flags, open the flag and fix it with the steps for that flag', 'Now, flags', 2),
    V('An item is edited only to make a flag disappear', 'Fix the real cause the flag points to. Never edit just to clear it', 'Now, flags', 2),
    V('A flag that cannot be fixed is not reported to Joe', 'If you cannot fix a flag, tell Joe the same day', 'Now, flags')] },
  { re: /Check the Sales Log at closing/i, title: 'Check the Sales Log at closing', v: [
    V('The closing Sales Log check is not done', 'Open the Sales Log and the day\'s receipts\nCount the cash and compare it with the log', 'Sales Log'),
    V('A cash difference is not written down and told to Joe before leaving', 'Write down the difference\nTell Joe before you leave', 'Sales Log')] },
  { re: /wrong tap is undone in the Sales Log/i, title: 'Correct wrong taps the same day', v: [
    V('A wrong tap is left uncorrected overnight', 'Open the Sales Log\nUndo the wrong tap\nEnter the right sale', 'Wrong sale|Undo|Sales Log'),
    V('A sale is deleted or hidden to make a figure match', 'Never delete or hide a sale. Undo it in the Sales Log and tell Joe if the day is closed', 'Wrong sale|Undo|Sales Log', 3)] },
  { re: /receipt comes from the Sales Log or MI/i, title: 'Never rewrite a receipt', v: [V('A customer receipt is retyped or rewritten', 'Find the receipt in the Sales Log or MI and give it as it is', 'Sales Log')] },
  { re: /open Item 360 and find the cause/i, title: 'Find the cause before changing an item', v: [V('An item is edited to change a loss, negative stock or price before its cause is found', 'Open Item 360\nRead the item\'s history\nFix the record that caused it', 'Item 360')] },
  { re: /changed only to fix a real mistake/i, title: 'Change item details only to fix a mistake', v: [V('An item is edited to hide a loss or make a count match', 'Edit an item only to correct a real mistake, and say what you corrected', 'Item 360', 3)] },
  { re: /Review Loss by Date/i, title: 'Review losses every week', v: [
    V('The weekly loss review is not done', 'Open Losses, then Loss by Items\nLook at the items with repeated losses', 'Loss'),
    V('An item with repeated losses is not counted again and its cause not written', 'Count the item again\nWrite the likely cause for Joe', 'Loss')] },
  { re: /not sold for a long time|Longest Unbought/i, title: 'Report long-unsold items', v: [V('A long-unsold item is reordered without telling Joe', 'Open Analytics, then Goods: Longest Unbought\nReport those items to Joe before any reorder', 'Analytics')] },
]
async function seedViolationLines() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('violations-v2') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, text FROM page_laws WHERE title IS NULL AND category = 'Stock & records'` as unknown as { id: number; text: string }[]
    for (const r of rows) {
      const rule = VIOLATION_RULES.find(x => x.re.test(r.text))
      if (rule) await sql`UPDATE page_laws SET title = ${rule.title}, violations = ${JSON.stringify(rule.v)}, not_violation = ${rule.not ?? null} WHERE id = ${r.id}`
    }
  } catch (e) { console.error('violation lines seed failed:', e instanceof Error ? e.message : String(e)) }
}

// The Items / Live Sale tile holds only laws about that page. Past days and receipts belong to the Sales Log; the app words are
// general training for everyone. A moved law gives up its old code and gets a new one where it lands. Written once.
async function scopeItemsLaws() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('items-scope-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE page_laws SET subcategory = 'Sales Log', code = NULL WHERE category = 'Stock & records' AND (text ~* 'Past days are entered only' OR text ~* 'Receipts are issued from MI')`
    await sql`UPDATE page_laws SET category = 'Staff management', subcategory = 'Training', code = NULL, scope_key = 'Staff management' WHERE category = 'Stock & records' AND text ~* '^Law: app words|App words:'`
    // the "refused sale is forced" violation belongs to recording a sale, not to receipts
    const refused = 'A sale the app refused is forced through instead of telling Joe'
    const rec = await sql`SELECT id, violations FROM page_laws WHERE text ~* 'Every walk-in sale goes in Live'` as unknown as { id: number; violations: string | null }[]
    const rcp = await sql`SELECT id, violations FROM page_laws WHERE text ~* 'Receipts are issued from MI'` as unknown as { id: number; violations: string | null }[]
    for (const r of rcp) {
      const list = parseViolations(r.violations), keep = list.filter(v => v.text !== refused), moved = list.find(v => v.text === refused)
      if (moved) {
        await sql`UPDATE page_laws SET violations = ${JSON.stringify(keep)} WHERE id = ${r.id}`
        for (const t of rec) { const tl = parseViolations(t.violations); if (!tl.some(v => v.text === refused)) await sql`UPDATE page_laws SET violations = ${JSON.stringify([...tl, { ...moved, how: 'If the app refuses a sale, such as a price below cost or not enough stock, do not force it\nTell Joe', chapter: 'Wrong sale|Undo' }])} WHERE id = ${t.id}` }
      }
    }
  } catch (e) { console.error('items scope migration failed:', e instanceof Error ? e.message : String(e)) }
}

// One law, one violation: the title of the law each violation line belongs to (the law is the positive form of the violation).
const LAW_FOR: Record<string, string> = {
  'A sale is not recorded in Live as soon as it happens': 'Record every sale as soon as it happens',
  'Shop use is recorded as a sale (WIC), or a customer sale is recorded as GMC': 'Record shop use as GMC and a customer sale as WIC',
  'A customer is not given a receipt for a sale': 'Give the customer a receipt for every sale',
  'Several items for one customer are recorded as separate sales and not through MI': 'Sell several items to one customer through MI',
  'A new item is created without first searching for an existing one': 'Search for an existing item before creating a new one',
  'A sale the app refused is forced through instead of telling Joe': 'Never force a sale the app refuses: tell Joe',
  'A past day is entered without + Past sale, or with the wrong sale date': 'Enter past days with + Past sale and the right date',
  'The same sale or work is typed twice': 'Never type the same sale or work twice',
  'A receipt is typed by hand into Customer Receipts': 'Issue receipts from MI or the Sales Log, never by hand',
  'The weekly item group check is not done on its day': 'Do the weekly item group check on its day',
  'An item is left in the wrong group, or in no group, after the check': 'Leave no item in the wrong group or in no group',
  'The monthly price check is not done': 'Do the monthly price check',
  'An old price is sold after the price list was updated': 'Never sell at an old price after the list is updated',
  'An entry is made with the wrong term, for example shop use recorded as a sale': 'Use the app words correctly',
  'A flag is left open overnight': 'Fix every flag as soon as it appears',
  'An item is edited only to make a flag disappear': 'Fix the cause of a flag, never just clear it',
  'A flag that cannot be fixed is not reported to Joe': 'Report a flag you cannot fix to Joe',
  'The closing Sales Log check is not done': 'Check the Sales Log at closing',
  'A cash difference is not written down and told to Joe before leaving': 'Write down a cash difference and tell Joe before leaving',
  'A wrong tap is left uncorrected overnight': 'Correct a wrong tap the same day',
  'A sale is deleted or hidden to make a figure match': 'Never delete or hide a sale to make a figure match',
  'The weekly loss review is not done': 'Review losses every week',
  'An item with repeated losses is not counted again and its cause not written': 'Count an item with repeated losses again and write its cause',
}
// A law with several violation lines is split into one law per violation (each with its own code, signatures and row). The first
// stays with the original law, so its checklist tile and signatures carry on; the others become standing laws. Written once.
async function splitMultiViolationLaws() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('split-laws-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, scope_key, category, subcategory, status, seed, violations, not_violation, title FROM page_laws WHERE violations IS NOT NULL AND violations <> '' AND violations <> '[]'` as unknown as { id: number; scope_key: string; category: string; subcategory: string | null; status: string; seed: string | null; violations: string; not_violation: string | null; title: string | null }[]
    for (const r of rows) {
      const list = parseViolations(r.violations)
      const first = list[0]
      if (!first) continue
      const t0 = LAW_FOR[first.text] ?? r.title
      if (list.length === 1) { if (t0 && t0 !== r.title) await sql`UPDATE page_laws SET title = ${t0} WHERE id = ${r.id}`; continue }
      await sql`UPDATE page_laws SET title = ${t0}, violations = ${JSON.stringify([first])} WHERE id = ${r.id}`
      for (const v of list.slice(1)) {
        const title = LAW_FOR[v.text] ?? v.text
        await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, dos, status, seed, proof, points, violations, title)
          VALUES (${r.scope_key}, ${title}, false, 'law', ${r.category}, ${r.subcategory}, 'standing', ${v.how ?? null}, ${r.status}, ${r.seed}, 'tick', ${v.points}, ${JSON.stringify([v])}, ${title})`
      }
    }
  } catch (e) { console.error('split laws failed:', e instanceof Error ? e.message : String(e)) }
}

// Three laws about knowing the Live Sale page itself (what it is for, the abbreviations, how to record a sale). They stand: a manager
// checks by asking, and logs a violation. Live straight away (the owner asked for them).
const UNDERSTAND: { title: string; violation: string; how: string; chapter: string }[] = [
  { title: 'Understand what Live is for', violation: 'A staff member cannot say, when a manager asks, what Live is for, what it solves, and what happens when a sale is not recorded', chapter: 'What Live is for|Welcome to Live|This is Live',
    how: 'Live is the main page of the shop\nEvery sale is recorded here, one item at a time, as it happens\nStock, cash and profit all come from what is recorded here\nA sale that is not recorded makes stock wrong and hides real profit' },
  { title: 'Know the app abbreviations', violation: 'A staff member cannot say, when a manager asks, what SOH, SP, CP, WIC, GMC or CAB stand for, or uses one wrongly', chapter: 'WIC',
    how: 'SOH: stock on hand\nSP: selling price. CP: cost price\nWIC: walk-in customer, a real sale\nGMC: Grony Multimedia as customer, shop use and not a sale\nCAB: cash at bank' },
  { title: 'Know how to find, price and record a sale', violation: 'A staff member cannot show, when a manager asks, how to find an item, set the quantity and price, and record the sale', chapter: 'Find the item|Search the item',
    how: 'Type the item name in Search\nCheck the quantity and the price on its card\nSay who it is for: a GM number, phone, name or label\nTap the red tick. The sale goes into the Sales Log' },
]
async function seedUnderstandingLaws() {
  try {
    if (await seedDone('understand-v1')) return
    for (const d of UNDERSTAND) {
      const v = [{ text: d.violation, points: 1, by: 'manager', how: d.how, chapter: d.chapter, record: 'A manager asks, in the shop, and logs it with a note' }]
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title)
        VALUES ('Stock & records', ${d.title}, false, 'law', 'Stock & records', 'Understanding', 'standing', 'live', 'understand-v1', 'tick', 1, ${JSON.stringify(v)}, ${d.title})`
    }
  } catch (e) { console.error('understanding laws seed failed:', e instanceof Error ? e.message : String(e)) }
}

// ---- SMART wording for the Items / Live Sale laws (Specific, Measurable, Achievable, Realistic, Time-bound), and a short quiz on each. Written once.
type Q = { q: string; options: string[]; answer: number; why: string }
const q = (qq: string, a: string, b: string, c: string, why: string): Q => ({ q: qq, options: [a, b, c], answer: 0, why })
const SHARP: { old: string; title: string; violation: string; points?: number; quiz: Q[] }[] = [
  { old: 'Record every sale as soon as it happens', title: 'Record every sale within 5 minutes of the customer paying', violation: 'A sale is recorded in Live more than 5 minutes after the customer paid', quiz: [
    q('How soon must a sale be recorded after the customer pays?', 'Within 5 minutes', 'By the end of the day', 'Whenever there is time', 'Late sales make stock and cash wrong.'),
    q('What does the red tick do?', 'Records the sale and sends it to the Sales Log', 'Prints the receipt only', 'Deletes the sale', 'The tick records the sale.')] },
  { old: 'Record shop use as GMC and a customer sale as WIC', title: 'Record shop use with GMC and every customer sale with WIC, every time', violation: 'A customer sale is recorded as GMC, or shop use is recorded as a sale (WIC)', quiz: [
    q('A customer buys a pen. Which switch is on?', 'WIC', 'GMC', 'Either one', 'WIC is a sale to a customer.'),
    q('The shop takes paper to print for itself. Which switch?', 'GMC', 'WIC', 'Neither', 'GMC is shop use and is not a sale.')] },
  { old: 'Give the customer a receipt for every sale', title: 'Hand every customer a receipt before they leave', violation: 'A customer leaves without a receipt', quiz: [
    q('Where does a customer receipt come from?', 'MI or the Sales Log', 'Typed into Customer Receipts', 'Written by hand', 'Receipts are never typed or written by hand.'),
    q('A customer is leaving with no receipt. What do you do?', 'Issue it before they leave', 'Let them go', 'Wait until tomorrow', 'Every customer gets a receipt before leaving.')] },
  { old: 'Sell several items to one customer through MI', title: 'Sell several items to one customer through MI: one basket, one receipt', violation: "Two or more receipts are issued for one customer's single purchase", quiz: [
    q('A customer buys three items. What do you tap?', 'MI', 'The red tick three times', 'GMC', 'MI keeps them in one basket.'),
    q('How many receipts for that purchase?', 'One', 'Three', 'None', 'One basket, one receipt.')] },
  { old: 'Never force a sale the app refuses: tell Joe', title: 'Never force a sale the app refuses: tell Joe at once', violation: 'A refused sale is forced through, or not reported to Joe the same day', quiz: [
    q('The app refuses a sale because stock is too low. What do you do?', 'Tell Joe and do not force it', 'Force it through', 'Delete the item', 'A forced sale makes the books untrue.')] },
  { old: 'Do the weekly item group check on its day', title: 'Complete the weekly item group check on its checklist day', violation: 'The weekly item group check is not completed by its checklist time', quiz: [
    q('How do you fix an item that has no group?', 'Open it, tap Edit, pick the group, tap Save', 'Delete it', 'Ignore it', 'The group is set in the item sheet.'),
    q('Why do item groups matter?', 'Reports, filters and counts depend on them', 'They are decoration', 'They do not matter', 'A wrongly grouped item hides in the wrong report.')] },
  { old: 'Leave no item in the wrong group or in no group', title: 'Leave no item in the wrong group, or in no group, for more than 24 hours after a check', violation: 'An item stays in the wrong group, or in no group, more than 24 hours after a check', quiz: [
    q('How long may an item stay in no group after a check?', 'No more than 24 hours', 'A week', 'Until Joe notices', 'It is fixed within 24 hours.')] },
  { old: 'Do the monthly price check', title: 'Complete the monthly price check on its day', violation: 'The monthly price check is not completed on its day', quiz: [
    q('How often is the price list checked?', 'Once a month', 'Once a year', 'Never', 'The price check is monthly.'),
    q('How do you correct a wrong price?', 'Open the item, Edit, type the price, Save', 'Delete the item', 'Tell the customer', 'Fix it in the item sheet.')] },
  { old: 'Never sell at an old price after the list is updated', title: 'Never sell at an out-of-date price after the list is updated', violation: 'An item is sold at an old price after the price list was updated', quiz: [
    q('What do you check on the card before the red tick?', 'The quantity and the price', 'Only the name', 'Nothing', 'A wrong price loses money on every sale.')] },
  { old: 'Fix every flag as soon as it appears', title: 'Fix every flag on Live the day it appears: none open at closing', violation: 'A flag is still open at closing time', points: 2, quiz: [
    q('Where are all the flags on Live?', 'The Flags dropdown on the toolbar', 'Under the logo', 'In the Sales Log', 'All flags are in one dropdown.'),
    q('When must a flag be fixed?', 'The same day it appears', 'Next week', 'When Joe asks', 'None may be open at closing.')] },
  { old: 'Fix the cause of a flag, never just clear it', title: 'Fix the real cause of a flag: never edit an item only to clear it', violation: 'An item is edited only to clear a flag, without fixing its cause', points: 2, quiz: [
    q('A flag says No Selling Price. What fixes it?', 'Type the real selling price and Save', 'Delete the item', 'Change its group', 'Fix the cause, never just clear the flag.')] },
  { old: 'Report a flag you cannot fix to Joe', title: 'Report any flag you cannot fix to Joe before closing', violation: 'A flag that cannot be fixed is not reported to Joe before closing', quiz: [
    q('You cannot fix a flag. What do you do?', 'Tell Joe before closing', 'Leave it', 'Edit the item at random', 'Joe must hear the same day.')] },
  { old: 'Understand what Live is for', title: 'Demonstrate strong understanding of the Live concept: what it is for, what it solves, all its features and how it is used', violation: 'A staff member fails to explain, when a manager asks, what Live is for, what it solves, its main features and how it is used, or scores below 80% on its quiz', quiz: [
    q('What is Live for?', 'Recording every sale as it happens', 'Ordering stock', 'Paying staff', 'It is where every sale is recorded.'),
    q('What does an unrecorded sale cause?', 'Wrong stock and cash figures', 'Nothing', 'Faster work', 'It hides real profit.'),
    q('Where do the stock, cash and profit figures come from?', 'What is recorded in Live', 'Guesses', 'Customers', 'Everything comes from the sales recorded.')] },
  { old: 'Know the app abbreviations', title: 'Demonstrate the meaning of every app abbreviation: SOH, SP, CP, WIC, GMC and CAB', violation: 'A staff member gets any one of the six abbreviations wrong when a manager asks, or uses one wrongly in an entry', quiz: [
    q('What does SOH stand for?', 'Stock on hand', 'Sales on hold', 'Shop opening hours', 'SOH is stock on hand.'),
    q('What is GMC?', 'Grony Multimedia as customer: shop use, not a sale', 'A walk-in customer', 'Cash at bank', 'GMC is shop use.'),
    q('What does CAB stand for?', 'Cash at bank', 'Customer account book', 'Count and bill', 'CAB is cash at bank.')] },
  { old: 'Know how to find, price and record a sale', title: 'Demonstrate recording a sale, from search to receipt, unaided and in under 2 minutes', violation: 'A staff member cannot record a sale from search to receipt without help, or takes more than 2 minutes, when a manager asks', quiz: [
    q('What is the first step in recording a sale?', 'Find the item in Search', 'Tap the red tick', 'Type the receipt', 'Search first.'),
    q('What must be said before the red tick?', 'Who the sale is for', 'Nothing', 'Only the date', 'A GM number, phone, name or label is required.')] },
]
const NEW_LAWS: { title: string; violation: string; how: string; quiz: Q[] }[] = [
  { title: 'Enter every sale in the app: no sale is ever made without an entry', violation: 'A sale is made and never entered in the app', how: 'Enter every sale as the customer pays\nUse Live, or MI for several items\nNever take payment and leave the sale out', quiz: [
    q('What is the sanction for making a sale and not entering it?', 'Dismissal', 'One penalty point', 'A warning', 'A sale left out of the app is treated as theft.'),
    q('Is a very small sale excused?', 'No, every sale is entered', 'Yes, under ₵10', 'Yes at night', 'Every sale, however small, is entered.')] },
  { title: 'Never steal or pilfer money, goods or stock belonging to the shop', violation: 'Money, goods or stock belonging to the shop is taken, hidden or kept for personal use', how: 'Never take, hide or keep shop money, goods or stock\nShop use is recorded with the GMC button, never taken quietly\nA customer overpayment or a found item is handed to Joe', quiz: [
    q('What is the sanction for stealing money, goods or stock?', 'Dismissal', 'One penalty point', 'A warning', 'Theft is dismissal.'),
    q('A staff member takes a small shop item home without recording it. What is that?', 'Pilfering, which means dismissal', 'Fine if it is small', 'Allowed with friends', 'Taking without recording is pilfering.')] },
]
async function sharpenItemsLaws() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('sharpen-items-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    // The manager or a superior watches the shop and the CCTV: none of these are enforced by the app itself.
    await sql`UPDATE page_laws SET law_type = 'standing' WHERE law_type = 'app' AND category = 'Stock & records'`
    // Only the owner and Joe add or delete items now, so the "search before creating an item" law no longer applies.
    const gone = await sql`DELETE FROM page_laws WHERE title = 'Search for an existing item before creating a new one' RETURNING id`
    for (const g of gone) await sql`DELETE FROM law_signatures WHERE law_id = ${g.id}`.catch(() => {})
    for (const d of SHARP) {
      const rows = await sql`SELECT id, violations FROM page_laws WHERE title = ${d.old}` as unknown as { id: number; violations: string | null }[]
      for (const r of rows) {
        const v0 = parseViolations(r.violations)[0]
        const v = { ...(v0 ?? { by: 'manager' as const }), text: d.violation, points: d.points ?? v0?.points ?? 1 }
        await sql`UPDATE page_laws SET title = ${d.title}, violations = ${JSON.stringify([v])}, quiz = ${JSON.stringify(d.quiz)} WHERE id = ${r.id}`
      }
    }
    for (const d of NEW_LAWS) {
      const v = [{ text: d.violation, points: 50, dismissal: true, by: 'manager', how: d.how, chapter: 'Find the item|Search the item', record: 'A manager or superior logs it: seen in the shop or on the CCTV' }]
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, proof, points, violations, title, quiz)
        VALUES ('Stock & records', ${d.title}, false, 'law', 'Stock & records', 'Recording', 'standing', 'live', 'sharpen-items-v1', 'tick', 20, ${JSON.stringify(v)}, ${d.title}, ${JSON.stringify(d.quiz)})`
    }
  } catch (e) { console.error('sharpen items laws failed:', e instanceof Error ? e.message : String(e)) }
}

// Flags are handled by managers only: the flag laws move to the managers-only section. Written once.
async function managersOnlyFlags() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('managers-flags-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql`UPDATE page_laws SET audience = 'managers' WHERE category = 'Stock & records' AND subcategory = 'Flags'`
  } catch (e) { console.error('managers flags migration failed:', e instanceof Error ? e.message : String(e)) }
}

// Standing orders of the Items / Live Sale and Sales Log tiles become app reminders: the ones needed before work starts show after login;
// the ones about selling show after the person's first sale of the day. Written once (the owner can change each law's reminder).
async function seedReminders() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('reminders-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, title, subcategory FROM page_laws WHERE law_type = 'standing' AND status = 'live' AND category = 'Stock & records'
      AND subcategory IN ('Item list', 'Prices', 'Recording', 'Know the words', 'Flags', 'Understanding', 'Sales Log')` as unknown as { id: number; title: string | null; subcategory: string }[]
    for (const r of rows) {
      const t = r.title ?? ''
      const login = /Enter every sale in the app|Never steal|Demonstrate|out-of-date price|real cause of a flag|cannot fix to Joe/i.test(t)
      await sql`UPDATE page_laws SET reminder = ${login ? 'login' : 'first_sale'} WHERE id = ${r.id}`
    }
  } catch (e) { console.error('reminders seed failed:', e instanceof Error ? e.message : String(e)) }
}
