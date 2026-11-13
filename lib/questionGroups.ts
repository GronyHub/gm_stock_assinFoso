import sql from '@/lib/db'
import { once } from '@/lib/once'
import { ensureDailyChecks } from '@/lib/dailyChecks'

// QUESTION GROUPS. The owner builds a set of questions from the Company Laws (or writes them), groups them, and the group appears as ONE tile on the checklist for the person it is
// assigned to (opener, closer, manager or everyone). Opening the tile shows every question; the tile is done when every required question has an answer. A question can point to a
// law (so it keeps a Law link) and "absorbs" that law's own tile, so the same thing is never asked twice. The group's tile can rest on a parent law, which is what costs the point if it is left undone.
export type ItemKind = 'tick' | 'yesno' | 'text' | 'number' | 'persons'
export type GroupItem = { law_text?: string | null; id: number; group_id: number; position: number; text: string; kind: ItemKind; detail_on: 'yes' | 'no' | null; law_id: number | null; key: string | null; required: boolean }
export type Group = { id: number; name: string; tile_id: number | null; bridge: string | null; active: boolean; items: GroupItem[]
  time: string | null; assignment: string | null; category: string | null; law_id: number | null; minutes: number | null }
export type AnswerIn = { item_id: number; answer: string; detail?: string }

const firstSentence = (t: string) => { const one = t.replace(/\s+/g, ' ').trim(); const m = one.match(/^(.{20,160}?[.!?])(\s|$)/); return (m ? m[1] : one).slice(0, 200) }

export const ensureQuestionGroups = once(async () => {
  await ensureDailyChecks()
  await sql`CREATE TABLE IF NOT EXISTS question_groups (id SERIAL PRIMARY KEY, name TEXT NOT NULL, tile_id INTEGER, active BOOLEAN NOT NULL DEFAULT TRUE, bridge TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS question_group_items (id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'tick',
    detail_on TEXT, law_id INTEGER, key TEXT, required BOOLEAN NOT NULL DEFAULT TRUE, active BOOLEAN NOT NULL DEFAULT TRUE)`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS question_group_answers (day TEXT NOT NULL, item_id INTEGER NOT NULL, answer TEXT NOT NULL, detail TEXT, by_who TEXT, at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (day, item_id))`.catch(() => {})
})

const KINDS: ItemKind[] = ['tick', 'yesno', 'text', 'number', 'persons']

export async function listGroups(): Promise<Group[]> {
  await ensureQuestionGroups()
  const gs = await sql`SELECT g.id, g.name, g.tile_id, g.bridge, g.active, t.time, t.assignment, t.category, t.law_id, t.minutes FROM question_groups g LEFT JOIN daily_check_tiles t ON t.id = g.tile_id WHERE g.active ORDER BY g.id` as unknown as Omit<Group, 'items'>[]
  const raw = await sql`SELECT i.id, i.group_id, i.position, i.text, i.kind, i.detail_on, i.law_id, i.key, i.required, l.text AS law_text FROM question_group_items i LEFT JOIN page_laws l ON l.id = i.law_id WHERE i.active ORDER BY i.group_id, i.position, i.id` as unknown as GroupItem[]
  // A question taken from a law shows the law's own wording (so editing the law changes the question); only written questions keep their own text.
  const items = raw.map(i => i.law_id && i.law_text ? { ...i, text: firstSentence(String(i.law_text)) } : i)
  return gs.map(g => ({ ...g, items: items.filter(i => i.group_id === g.id) }))
}
export async function groupForTile(tileId: number): Promise<Group | null> { return (await listGroups()).find(g => g.tile_id === tileId) ?? null }
export async function hasClosingGroups(): Promise<boolean> {
  try { await ensureQuestionGroups(); const r = await sql`SELECT 1 FROM question_groups WHERE active AND bridge = 'closing' LIMIT 1`; return r.length > 0 } catch { return false }
}

export type SaveGroup = { id?: number; name: string; bridge?: string | null; lawId?: number | null; time?: string | null; minutes?: number | null; assignment?: string | null; category?: string | null; absorb?: boolean
  items: { text: string; kind: ItemKind; detail_on?: 'yes' | 'no' | null; law_id?: number | null; key?: string | null; required?: boolean }[] }

// Creates or updates a group and its tile. With a parent law that already has a tile, that tile becomes the group's tile (so the law's schedule, points and Law link carry over);
// otherwise a tile of its own is made from the time / assignment given. With `absorb`, the laws the questions point to stop appearing as separate tiles.
export async function saveGroup(g: SaveGroup, by: string): Promise<number> {
  await ensureQuestionGroups()
  const name = g.name.trim().slice(0, 120)
  if (!name) throw new Error('Name the group.')
  const items = g.items.map(i => ({ ...i, text: String(i.text ?? '').trim().slice(0, 400) })).filter(i => i.text)
  if (!items.length) throw new Error('Add at least one question.')
  let gid = g.id ?? null, tileId: number | null = null
  if (gid) { const [r] = await sql`SELECT tile_id FROM question_groups WHERE id = ${gid}`; tileId = (r?.tile_id as number | null) ?? null }
  if (!tileId && g.lawId) { const [l] = await sql`SELECT tile_id FROM page_laws WHERE id = ${g.lawId}`; tileId = (l?.tile_id as number | null) ?? null }
  if (!tileId) {
    const hhmm = g.time && /^[0-2][0-9]:[0-5][0-9]$/.test(g.time) ? g.time : '18:00'
    const [t] = await sql`INSERT INTO daily_check_tiles (section, category, time, title, icon, kind, frequency, minutes, law_id, position, created_by, assignment)
      VALUES (${g.category || 'Questions'}, ${g.category || 'Questions'}, ${hhmm}, ${name}, '📝', 'group', 'daily', ${g.minutes ?? 5}, ${g.lawId ?? null}, (SELECT COALESCE(MAX(position), 0) + 1 FROM daily_check_tiles), ${by}, ${g.assignment || 'all'}) RETURNING id`
    tileId = t.id as number
  }
  if (gid) await sql`UPDATE question_groups SET name = ${name}, tile_id = ${tileId}, bridge = ${g.bridge ?? null}, active = TRUE WHERE id = ${gid}`
  else { const [r] = await sql`INSERT INTO question_groups (name, tile_id, bridge) VALUES (${name}, ${tileId}, ${g.bridge ?? null}) RETURNING id`; gid = r.id as number }
  await sql`UPDATE daily_check_tiles SET kind = 'group', title = ${name}, active = true WHERE id = ${tileId}`
  await sql`UPDATE question_group_items SET active = FALSE WHERE group_id = ${gid}`
  let pos = 0
  for (const i of items) {
    const kind = KINDS.includes(i.kind) ? i.kind : 'tick'
    await sql`INSERT INTO question_group_items (group_id, position, text, kind, detail_on, law_id, key, required) VALUES (${gid}, ${pos++}, ${i.text}, ${kind}, ${kind === 'yesno' ? i.detail_on ?? null : null}, ${i.law_id ?? null}, ${i.key ?? null}, ${i.required !== false})`
  }
  if (g.absorb !== false) await absorbLawTiles(gid!)
  return gid!
}

// A law whose question lives in a group does not also keep its own tile.
export async function absorbLawTiles(groupId: number) {
  await sql`UPDATE daily_check_tiles SET active = FALSE WHERE law_id IN (SELECT law_id FROM question_group_items WHERE group_id = ${groupId} AND active AND law_id IS NOT NULL)
    AND id <> COALESCE((SELECT tile_id FROM question_groups WHERE id = ${groupId}), -1)`
}
export async function removeGroup(id: number) {
  await ensureQuestionGroups()
  const [g] = await sql`SELECT tile_id FROM question_groups WHERE id = ${id}`
  const laws = await sql`SELECT law_id FROM question_group_items WHERE group_id = ${id} AND active AND law_id IS NOT NULL` as unknown as { law_id: number }[]
  await sql`UPDATE question_groups SET active = FALSE WHERE id = ${id}`
  if (g?.tile_id) {
    const [t] = await sql`SELECT law_id, created_by FROM daily_check_tiles WHERE id = ${g.tile_id}`
    if (t?.created_by === 'group' || !t?.law_id) await sql`UPDATE daily_check_tiles SET active = FALSE WHERE id = ${g.tile_id}`
    else await sql`UPDATE daily_check_tiles SET kind = 'tap' WHERE id = ${g.tile_id}`
  }
  const { syncLawTile } = await import('@/lib/lawTiles')
  for (const l of laws) await syncLawTile(l.law_id).catch(() => {})
  if (g?.tile_id) { const [t] = await sql`SELECT law_id FROM daily_check_tiles WHERE id = ${g.tile_id}`; if (t?.law_id) await syncLawTile(t.law_id as number).catch(() => {}) }
}

export async function answersFor(groupId: number, day: string) {
  return await sql`SELECT a.item_id, a.answer, a.detail, a.by_who FROM question_group_answers a JOIN question_group_items i ON i.id = a.item_id WHERE a.day = ${day} AND i.group_id = ${groupId}` as unknown as { item_id: number; answer: string; detail: string | null; by_who: string | null }[]
}

const needsDetail = (i: GroupItem, a: string) => i.kind === 'yesno' && i.detail_on != null && a === i.detail_on
// Saves the answers; returns whether every required question now has one. Throws a plain message when an answer is not acceptable.
export async function saveAnswers(group: Group, day: string, who: string, answers: AnswerIn[]): Promise<{ complete: boolean }> {
  await ensureQuestionGroups()
  const byId = new Map(group.items.map(i => [i.id, i]))
  for (const a of answers) {
    const i = byId.get(Number(a.item_id)); if (!i) continue
    const ans = String(a.answer ?? '').trim().slice(0, 500)
    if (!ans) continue
    if (i.kind === 'yesno' && ans !== 'yes' && ans !== 'no') throw new Error(`Answer Yes or No: ${i.text.slice(0, 60)}`)
    if (i.kind === 'number' && !Number.isFinite(Number(ans))) throw new Error(`Enter a number: ${i.text.slice(0, 60)}`)
    const detail = String(a.detail ?? '').trim().slice(0, 500)
    if (needsDetail(i, ans) && detail.length < 3) throw new Error(`Say what happened: ${i.text.slice(0, 60)}`)
    await sql`INSERT INTO question_group_answers (day, item_id, answer, detail, by_who) VALUES (${day}, ${i.id}, ${ans}, ${detail || null}, ${who})
      ON CONFLICT (day, item_id) DO UPDATE SET answer = EXCLUDED.answer, detail = EXCLUDED.detail, by_who = EXCLUDED.by_who, at = now()`
  }
  return { complete: await isComplete(group, day) }
}
export async function isComplete(group: Group, day: string): Promise<boolean> {
  const have = new Set((await answersFor(group.id, day)).map(a => a.item_id))
  return group.items.filter(i => i.required).every(i => have.has(i.id))
}

// The closing report keeps its own table (other pages read it). When every closing group has been answered for the day, the answers that carry a key are written there too.
export async function bridgeClosing(day: string) {
  const gs = (await listGroups()).filter(g => g.bridge === 'closing')
  if (!gs.length) return
  for (const g of gs) if (!(await isComplete(g, day))) return
  const all: Record<string, { answer: string; detail: string | null; by: string | null }> = {}
  let closer: string | null = null
  for (const g of gs) {
    const keyOf = new Map(g.items.map(i => [i.id, i.key]))
    for (const a of await answersFor(g.id, day)) { const k = keyOf.get(a.item_id); if (k) all[k] = { answer: a.answer, detail: a.detail, by: a.by_who }; if (!closer && a.by_who) closer = a.by_who }
  }
  const yes = (k: string) => all[k]?.answer === 'yes'
  const { saveClosingReport } = await import('@/lib/closingReports')
  await saveClosingReport(day, closer ?? 'unknown', {
    no_tshirt_staff: (all.no_tshirt?.answer ?? '').split(',').map(s => s.trim()).filter(s => s && s !== 'none') as unknown as never,
    advert_played: yes('advert_played'), property_issue: yes('property_issue'), speaker_brought_in: yes('speaker_brought_in'),
    new_customer: yes('new_customer'), new_customer_details: all.new_customer?.detail ?? null,
    unfortunate_event: yes('unfortunate_event'), unfortunate_event_details: all.unfortunate_event?.detail ?? null,
  })
}

// One-time set-up (run from the laws migrations): the Opening questions group from the opener's tick tasks, and the closing report split in two: the Closer's group (the closing
// tick tasks plus the closing questions about the shop) and the Manager's group (the judgement questions). Each rests on the law its old tile rested on, so the point still works.
export async function seedQuestionGroupsOnce() {
  await ensureQuestionGroups()
  const c = await sql`INSERT INTO law_migrations (key) VALUES ('question-groups-seed-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
  if (!c.length) return
  try {
    const parent = async (like: string) => (await sql`SELECT id, law_id FROM daily_check_tiles WHERE active AND title LIKE ${like} AND law_id IS NOT NULL ORDER BY id LIMIT 1`)[0] as { id: number; law_id: number } | undefined
    const ticks = async (assignment: string, exceptId: number) => await sql`SELECT title, law_id FROM daily_check_tiles WHERE active AND frequency = 'daily' AND kind = 'tap' AND assignment = ${assignment}
      AND law_id IS NOT NULL AND time IS NOT NULL AND id <> ${exceptId} ORDER BY time, id` as unknown as { title: string; law_id: number }[]
    const tick = (r: { title: string; law_id: number }) => ({ text: r.title, kind: 'tick' as ItemKind, law_id: r.law_id })
    const op = await parent('Opening questions answered%')
    if (op) await saveGroup({ name: 'Opening questions', lawId: op.law_id, items: (await ticks('opener', op.id)).map(tick) }, 'seed')
    const cl = await parent('Closing questions answered in the app (Closer)%')
    if (cl) await saveGroup({ name: 'Closing questions (closer)', lawId: cl.law_id, bridge: 'closing', items: [
      ...(await ticks('closer', cl.id)).map(tick),
      { text: 'Select the staff who did not wear the company T-shirt today.', kind: 'persons', key: 'no_tshirt' },
      { text: 'Was the roadside advert played today?', kind: 'yesno', key: 'advert_played' },
      { text: 'Was any property spoilt or lost today?', kind: 'yesno', detail_on: 'yes', key: 'property_issue' },
      { text: 'Is the speaker and its wires brought in?', kind: 'yesno', key: 'speaker_brought_in' },
    ] }, 'seed')
    if (cl) await saveGroup({ name: 'Closing questions (manager)', bridge: 'closing', assignment: 'managers', time: '19:05', category: 'Staff management', items: [
      { text: 'Is there a new customer of interest today?', kind: 'yesno', detail_on: 'yes', key: 'new_customer' },
      { text: 'Did anything unfortunate happen today?', kind: 'yesno', detail_on: 'yes', key: 'unfortunate_event' },
    ] }, 'seed')
  } catch (e) { console.error('question groups seed failed:', e instanceof Error ? e.message : String(e)) }
}
