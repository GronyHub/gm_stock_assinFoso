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
    ADD COLUMN IF NOT EXISTS dos TEXT, ADD COLUMN IF NOT EXISTS donts TEXT, ADD COLUMN IF NOT EXISTS sort_order INTEGER`.catch(() => {})
  try {
    for (const [id, cat, sub, type, days, freq] of FIRST_SORT) {
      await sql`UPDATE page_laws SET category = ${cat}, subcategory = ${sub}, law_type = ${type}, days = ${days}, frequency = ${freq} WHERE id = ${id} AND category IS NULL`
    }
  } catch (e) { console.error('company laws first sort failed:', e instanceof Error ? e.message : String(e)) }
}
export const ensureCompanyLaws = once(ensureCompanyLawsImpl)

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
