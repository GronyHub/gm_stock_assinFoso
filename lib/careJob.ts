import sql from '@/lib/db'
import { once } from '@/lib/once'

// The caretaker's job rules, one row per law, each signed separately. Editing a
// rule bumps its version, so an earlier signature no longer counts for it.
export { JOB_SECTIONS } from './caretakerShared'

const SEED: [string, string][] = [
  ['Job', 'You are the caretaker of the house and of the four children: Fiifi, Kuukua, Ebo and Odoye. You keep them safe, healthy, clean, fed, on time and well behaved, and you keep the house clean.'],
  ['Responsibility', 'Get the children up by 5:30am, teeth brushed by 5:45am, bathed by 6:30am, dressed by 6:45am, breakfast finished by 7:15am and leaving for school by 7:30am (Monday to Friday).'],
  ['Responsibility', 'Receive the children back from school at 4:30pm: they undress and put on house clothes, eat at 6:30pm and bathe after supper.'],
  ['Responsibility', 'Sweep the house at 8pm and have the children in bed by 8:30pm.'],
  ['Responsibility', 'Do the night checks at 10pm, 1am and 4am for every child: fan, mosquitoes, posture, bedwetting (especially Fiifi), covered and safe.'],
  ['Responsibility', 'Watch the children\'s health, food, skin, hair, school needs, homework and behaviour, and record them.'],
  ['Responsibility', 'Tap each tile in Care Today when it is done, and log extra activities, house chores and behaviour. Records show the real time.'],
  ['Responsibility', 'Take the daily bathroom photos and keep every room clean, with no cobwebs.'],
  ['Responsibility', 'Do the house chores (sweeping, mopping, washing, ironing, cooking, fetching water, turning on the water pumping machine, weeding and the rest). The children help with age-suitable chores.'],
  ['Do', 'Sit with the children and give them your attention.'],
  ['Do', 'Record things as they happen, not later from memory.'],
  ['Do', 'Tell the owners at once about any illness, injury, fight or anything unusual.'],
  ['Do', 'Keep the house, bathrooms, kitchen, yard and water area clean.'],
  ['Do', 'Keep the gate and doors locked at night.'],
  ['Don\'t', 'Do not make or take phone calls near the children.'],
  ['Don\'t', 'Do not leave the children alone or unchecked at night.'],
  ['Don\'t', 'Do not leave cobwebs, dirt or rubbish in the house.'],
  ['Don\'t', 'Do not tap a tile for something that was not done.'],
  ['Don\'t', 'Do not let visitors in without the owners knowing.'],
]

async function ensureImpl() {
  await sql`CREATE TABLE IF NOT EXISTS care_job_rules (
    id SERIAL PRIMARY KEY, section TEXT NOT NULL, text TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS care_job_signs (
    id SERIAL PRIMARY KEY, rule_id INTEGER NOT NULL, rule_version INTEGER NOT NULL, rule_text TEXT NOT NULL,
    signed_name TEXT NOT NULL, signed_by TEXT NOT NULL, signed_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS care_job_obs (
    id SERIAL PRIMARY KEY, rule_id INTEGER, kind TEXT NOT NULL DEFAULT 'note', note TEXT NOT NULL,
    obs_date DATE NOT NULL DEFAULT CURRENT_DATE, logged_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM care_job_rules`
  if (n === 0) for (let i = 0; i < SEED.length; i++) await sql`INSERT INTO care_job_rules (section, text, position) VALUES (${SEED[i][0]}, ${SEED[i][1]}, ${i + 1})`.catch(() => {})
  await seedObs().catch(e => console.error('careJob seedObs:', e instanceof Error ? e.message : String(e)))
}
// The owner's own observations, told to Claude on 15 Oct 2026 (made over her first three weeks in Ghana).
// Inserted once, each under the rule it concerns; the flag stops them returning if removed later.
const OBS_SEED: [string, string][] = [
  ['Do not leave cobwebs', 'Cobwebs all over the house, especially at the bath. No cobwebs should be found in any part of the house.'],
  ['Do not make or take phone calls', 'Makes too many calls and is always on the phone. She must make no calls in the presence of the children: giving them her time is the work she is there to do.'],
  ['Sit with the children', 'Does not spend quality time with the children when there is nothing to be done, leaving them to their fate. When they play in the living room she should sit with them there, not go outside the building or into the small room to make calls.'],
  ['Do not leave the children alone or unchecked at night', 'At night she never wakes to check on the children and sleeps fully. Fiifi bedwets and needs support to urinate at night. The fan is sometimes too strong, mosquitoes need covering with clothes, and the children sometimes take very bad sleeping postures.'],
]

async function seedObs() {
  await sql`CREATE TABLE IF NOT EXISTS care_job_flags (key TEXT PRIMARY KEY)`.catch(() => {})
  const [f] = await sql`SELECT 1 AS x FROM care_job_flags WHERE key = 'obs_seed_1'`
  if (f) return
  for (const [prefix, note] of OBS_SEED) {
    const [r] = await sql`SELECT id FROM care_job_rules WHERE active AND text LIKE ${prefix + '%'} ORDER BY id LIMIT 1`
    await sql`INSERT INTO care_job_obs (rule_id, kind, note, obs_date, logged_by) VALUES (${r?.id ?? null}, 'concern', ${note}, '2026-10-15', 'grony')`
  }
  await sql`INSERT INTO care_job_flags (key) VALUES ('obs_seed_1') ON CONFLICT DO NOTHING`
}

export const ensureCareJob = once(ensureImpl)
