import { getAuthUser, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { isOwnerLevel } from '@/lib/roles'
import { CODE_VERSION } from '@/lib/customerServiceCode'

const ensureTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS customer_service_acks (
      username TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

const nameOf = (u: any) => String(u?.username ?? u?.name ?? '').toLowerCase()

// GET: my own acknowledgement; owner-level also gets everyone's (active logins) so they can see who has agreed.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureTable()
    const me = nameOf(user)
    const [mine] = await sql`SELECT version, acknowledged_at FROM customer_service_acks WHERE username = ${me}`
    const out: Record<string, unknown> = {
      version: CODE_VERSION,
      mine: mine ? { version: Number(mine.version), at: mine.acknowledged_at } : null,
    }
    if (isOwnerLevel(user as any)) {
      out.all = await sql`
        SELECT LOWER(u.username) AS username, u.display_name, u.role, a.version, a.acknowledged_at
        FROM app_users u LEFT JOIN customer_service_acks a ON a.username = LOWER(u.username)
        WHERE u.active IS NOT FALSE ORDER BY u.id
      `
    }
    return success(out)
  } catch (e) { return handleError('customer-service ack GET', e) }
}

// POST: the signed-in person agrees to the current version of the Code.
export async function POST() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureTable()
    const me = nameOf(user)
    await sql`
      INSERT INTO customer_service_acks (username, version, acknowledged_at) VALUES (${me}, ${CODE_VERSION}, now())
      ON CONFLICT (username) DO UPDATE SET version = EXCLUDED.version, acknowledged_at = now()
    `
    return success({ version: CODE_VERSION, at: new Date().toISOString() })
  } catch (e) { return handleError('customer-service ack POST', e) }
}
