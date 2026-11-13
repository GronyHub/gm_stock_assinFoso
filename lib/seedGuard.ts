import sql from '@/lib/db'

// A built-in set of laws is made once. It counts as done while any law of that set exists, AND once the owner has deleted the last one (the delete records `seed-retired:<set>`),
// so deleting a law from the Company Laws page is permanent: restarting the app or restructuring never brings it back.
export async function seedDone(seed: string): Promise<boolean> {
  await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  const [r] = await sql`SELECT (SELECT COUNT(*) FROM page_laws WHERE seed = ${seed}) + (SELECT COUNT(*) FROM law_migrations WHERE key = ${'seed-retired:' + seed}) AS n`
  return Number(r?.n ?? 0) > 0
}
export async function retireSeed(seed: string | null) {
  if (!seed) return
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = ${seed}`
  if (Number(r?.n ?? 0) === 0) await sql`INSERT INTO law_migrations (key) VALUES (${'seed-retired:' + seed}) ON CONFLICT DO NOTHING`.catch(() => {})
}
