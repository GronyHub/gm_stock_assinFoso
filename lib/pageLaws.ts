import sql from '@/lib/db'
import { once } from '@/lib/once'

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
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'live', ADD COLUMN IF NOT EXISTS tile_id INTEGER, ADD COLUMN IF NOT EXISTS seed TEXT`.catch(() => {})
  try {
    for (const [id, cat, sub, type, days, freq] of FIRST_SORT) {
      await sql`UPDATE page_laws SET category = ${cat}, subcategory = ${sub}, law_type = ${type}, days = ${days}, frequency = ${freq} WHERE id = ${id} AND category IS NULL`
    }
  } catch (e) { console.error('company laws first sort failed:', e instanceof Error ? e.message : String(e)) }
  await seedAdvertsPilot() // after the first sort, so the existing daily advert laws are already marked recurring
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
  }
}
