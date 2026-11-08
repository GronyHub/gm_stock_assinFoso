import sql from '@/lib/db'
import { ensureDailyChecks, pickIcon } from '@/lib/dailyChecks'

const firstSentence = (t: string) => {
  const one = t.replace(/\s+/g, ' ').trim()
  const m = one.match(/^(.{20,160}?[.!?])(\s|$)/)
  return (m ? m[1] : one).slice(0, 200)
}

// Keeps a recurring, live law and its checklist tile in step. A recurring law with a frequency and minutes gets one tile
// (created the first time, updated after); anything else (a draft, a standing rule, a law without a schedule, a deleted
// law) has its tile stopped. The tile carries the law's category so the checklist and History group by it.
export async function syncLawTile(lawId: number) {
  await ensureDailyChecks()
  const [l] = await sql`SELECT id, text, category, subcategory, law_type, days, law_time, frequency, minutes, dos, status, tile_id, proof FROM page_laws WHERE id = ${lawId}`
  if (!l) { await sql`UPDATE daily_check_tiles SET active = false WHERE law_id = ${lawId}`; return }
  const wants = l.status === 'live' && l.law_type === 'recurring' && l.frequency && l.minutes && l.category
  if (!wants) {
    if (l.tile_id) await sql`UPDATE daily_check_tiles SET active = false WHERE id = ${l.tile_id}`
    return
  }
  const title = firstSentence(String(l.text))
  const how = [String(l.text).length > title.length ? String(l.text) : '', l.dos ? 'Do:\n' + String(l.dos) : ''].filter(Boolean).join('\n\n') || null
  const days = l.frequency === 'daily' ? (l.days ?? null) : null
  const weekday = l.frequency === 'weekly' && l.days ? String(l.days).split(',')[0] : null
  const time = l.law_time ?? null
  const icon = pickIcon(String(l.text), 'Daytime')
  const photo = l.proof === 'photo'
  const kind = photo ? 'entry' : 'tap'
  const logCat = photo ? (LOG_FOR_CATEGORY[String(l.category)] ?? null) : null
  if (l.tile_id) {
    await sql`UPDATE daily_check_tiles SET active = true, title = ${title}, how = ${how}, section = ${l.category}, category = ${l.category}, subcategory = ${l.subcategory},
      time = ${time}, frequency = ${l.frequency}, days = ${days}, weekday = ${weekday}, minutes = ${l.minutes}, icon = ${icon}, law_id = ${lawId},
      kind = ${kind}, needs_photo = ${photo}, log_category = ${logCat} WHERE id = ${l.tile_id}`
  } else {
    const [t] = await sql`INSERT INTO daily_check_tiles (section, category, subcategory, time, title, icon, how, kind, frequency, days, weekday, minutes, law_id, position, created_by, needs_photo, log_category)
      VALUES (${l.category}, ${l.category}, ${l.subcategory}, ${time}, ${title}, ${icon}, ${how}, ${kind}, ${l.frequency}, ${days}, ${weekday}, ${l.minutes}, ${lawId},
              (SELECT COALESCE(MAX(position), 0) + 1 FROM daily_check_tiles), 'law', ${photo}, ${logCat}) RETURNING id`
    await sql`UPDATE page_laws SET tile_id = ${t.id} WHERE id = ${lawId}`
  }
}

// Approving drafts makes them live and creates their tiles. For some categories the old Standards tiles they replace are
// stopped at the same time (their records are kept).
// Photo checks write into the Grony Manage log of the same name, so that page keeps its history.
const LOG_FOR_CATEGORY: Record<string, string> = { 'Cleanliness & safety': 'cleanliness' }
const RETIRE_ON_APPROVE: Record<string, string[]> = { 'Adverts & marketing': ['Social media'] }
export async function approveDrafts(where: { id?: number; category?: string }) {
  const ids = (where.id
    ? await sql`UPDATE page_laws SET status = 'live' WHERE id = ${where.id} AND status = 'draft' RETURNING id, category`
    : await sql`UPDATE page_laws SET status = 'live' WHERE category = ${where.category ?? ''} AND status = 'draft' RETURNING id, category`) as unknown as { id: number; category: string }[]
  for (const r of ids) await syncLawTile(r.id)
  // Live recurring laws in this category that have a full schedule but no tile yet (the existing ones) get theirs too.
  const cat = where.category ?? ids[0]?.category
  if (cat) {
    const pending = await sql`SELECT id FROM page_laws WHERE category = ${cat} AND status = 'live' AND law_type = 'recurring' AND frequency IS NOT NULL AND minutes IS NOT NULL AND tile_id IS NULL` as unknown as { id: number }[]
    for (const r of pending) await syncLawTile(r.id)
    if (ids.length) for (const sec of RETIRE_ON_APPROVE[cat] ?? []) await sql`UPDATE daily_check_tiles SET active = false WHERE section = ${sec} AND created_by = 'template' AND active`
    if (ids.length && cat === 'Cleanliness & safety') await sql`UPDATE daily_check_tiles SET active = false WHERE created_by = 'manage-tiles-v1' AND log_category = 'cleanliness' AND law_id IS NULL AND active`
  }
  return ids.length
}

// Approves every draft of one seeded set (any category), creates their tiles, and stops the old tiles they replace.
export async function approveSeed(seed: string) {
  const ids = await sql`UPDATE page_laws SET status = 'live' WHERE seed = ${seed} AND status = 'draft' RETURNING id, category` as unknown as { id: number; category: string }[]
  for (const r of ids) await syncLawTile(r.id)
  const cats = Array.from(new Set(ids.map(r => r.category)))
  for (const cat of cats) {
    const pending = await sql`SELECT id FROM page_laws WHERE category = ${cat} AND status = 'live' AND law_type = 'recurring' AND frequency IS NOT NULL AND minutes IS NOT NULL AND tile_id IS NULL` as unknown as { id: number }[]
    for (const r of pending) await syncLawTile(r.id)
    for (const sec of RETIRE_ON_APPROVE[cat] ?? []) await sql`UPDATE daily_check_tiles SET active = false WHERE section = ${sec} AND created_by = 'template' AND active`
    if (cat === 'Cleanliness & safety') await sql`UPDATE daily_check_tiles SET active = false WHERE created_by = 'manage-tiles-v1' AND log_category = 'cleanliness' AND law_id IS NULL AND active`
  }
  return ids.length
}
