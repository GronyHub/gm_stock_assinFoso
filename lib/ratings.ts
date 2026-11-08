import crypto from 'crypto'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { notifyOwners, pushToUsers } from '@/lib/checklistAlerts'

// Customer ratings: each receipt message carries a link; the customer taps 1 to 5 stars on a plain page (no login). The
// rating is saved against the sale and the staff member who served them, who is told at once; a low rating alerts the owner.
export const APP_BASE = process.env.APP_BASE_URL || 'https://app.gronymultimedia.com'
export const ensureRatings = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS service_ratings (
    id SERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, source_id INTEGER NOT NULL, staff TEXT NOT NULL, customer TEXT,
    stars INTEGER, comment TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), rated_at TIMESTAMPTZ)`.catch(() => {})
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS service_ratings_src ON service_ratings (kind, source_id)`.catch(() => {})
})

// The rating link for a sale (made once per sale; a re-sent message reuses it). Never throws: a failure just means no link.
export async function ratingLink(staff: string, kind: 'tap' | 'invoice' | 'buyer' | 'receipt', sourceId: number | null | undefined, customer?: string | null): Promise<string | null> {
  try {
    if (!sourceId) return null
    await ensureRatings()
    const token = crypto.randomBytes(9).toString('base64url')
    const [r] = await sql`INSERT INTO service_ratings (token, kind, source_id, staff, customer) VALUES (${token}, ${kind}, ${sourceId}, ${staff.toLowerCase()}, ${customer ?? null})
      ON CONFLICT (kind, source_id) DO UPDATE SET kind = EXCLUDED.kind RETURNING token`
    return `${APP_BASE}/rate/${r.token}`
  } catch (e) { console.error('rating link failed:', e instanceof Error ? e.message : String(e)); return null }
}

export async function getRatingInfo(token: string) {
  await ensureRatings()
  const [r] = await sql`SELECT staff, stars FROM service_ratings WHERE token = ${token}`
  return r ? { staff: String(r.staff), rated: r.stars != null, stars: r.stars as number | null } : null
}

const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
export async function recordRating(token: string, stars: number, comment: string | null) {
  await ensureRatings()
  const [r] = await sql`UPDATE service_ratings SET stars = ${stars}, comment = ${comment}, rated_at = now() WHERE token = ${token} AND stars IS NULL RETURNING staff, customer`
  if (!r) return false
  const staff = String(r.staff)
  void pushToUsers([staff], `${'★'.repeat(stars)} from a customer`, comment ? `"${comment.slice(0, 100)}"` : `A customer rated your service ${stars} out of 5. Thank you!`)
  if (stars <= 2) void notifyOwners(`Low rating for ${cap(staff)}: ${stars} of 5`, comment ? `"${comment.slice(0, 120)}"` : `${r.customer ? String(r.customer) + ' rated' : 'A customer rated'} the service ${stars} out of 5. Follow up while you can win them back.`)
  return true
}

// Scorecard: average and count over the last `days`, per staff member; and the week's Service Star (best average, at least 3 ratings).
export async function scorecard(days = 30) {
  await ensureRatings()
  const rows = await sql`
    SELECT staff, COUNT(*)::int AS n, ROUND(AVG(stars)::numeric, 2)::float AS avg,
           COUNT(*) FILTER (WHERE stars <= 2)::int AS low
    FROM service_ratings WHERE stars IS NOT NULL AND rated_at >= now() - (${days} || ' days')::interval GROUP BY staff ORDER BY avg DESC, n DESC` as unknown as { staff: string; n: number; avg: number; low: number }[]
  const week = await sql`
    SELECT staff, COUNT(*)::int AS n, AVG(stars)::float AS avg FROM service_ratings
    WHERE stars IS NOT NULL AND rated_at >= now() - interval '7 days' GROUP BY staff HAVING COUNT(*) >= 3 ORDER BY avg DESC, n DESC LIMIT 1` as unknown as { staff: string }[]
  return { rows, star: week[0]?.staff ?? null }
}
