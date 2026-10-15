import sql from './db'
import { once } from './once'
import { isOwnerLevel } from './roles'

export const ensureCaretakerTables = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS care_events (
      id SERIAL PRIMARY KEY,
      child TEXT,
      kind TEXT NOT NULL,
      value TEXT,
      note TEXT,
      photo_url TEXT,
      extra JSONB,
      recorded_by TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS care_events_time_idx ON care_events (recorded_at)`.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS care_children (
      name TEXT PRIMARY KEY,
      photo_url TEXT
    )
  `.catch(() => {})
  // Which missed-item alerts have already been sent, so a server restart or a
  // second tick never sends the same alert twice.
  await sql`
    CREATE TABLE IF NOT EXISTS care_alerts_sent (
      alert_date DATE NOT NULL,
      alert_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (alert_date, alert_key)
    )
  `.catch(() => {})
})

type SessionLike = { user?: { role?: string | null; username?: string | null; name?: string | null } } | null | undefined

export function caretakerName(session: SessionLike): string {
  return ((session?.user?.username ?? session?.user?.name ?? '') as string).toLowerCase()
}

// Who may use the caretaker pages: the children_manager role (Beatrice), the
// owners, and anyone granted the 'caretaker' permission on the Roles &
// Permissions screen (user_permissions row) -- e.g. Marian.
export async function canCaretake(session: SessionLike): Promise<boolean> {
  const u = session?.user as { id?: string; role?: string | null; username?: string | null; name?: string | null } | undefined
  if (!u) return false
  if (u.role === 'children_manager' || isOwnerLevel(u)) return true
  const id = Number(u.id)
  if (!id) return false
  try {
    const rows = await sql`SELECT allowed FROM user_permissions WHERE user_id = ${id} AND feature_key = 'caretaker'`
    return !!rows[0]?.allowed
  } catch { return false }
}

export function isOwnerSession(session: SessionLike): boolean {
  return !!session?.user && isOwnerLevel(session.user as { role?: string; username?: string; name?: string | null })
}
