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
}
export const ensureCareJob = once(ensureImpl)
