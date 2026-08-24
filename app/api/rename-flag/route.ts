import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

const ensureCustomFlagNames = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS custom_flag_names (flag_key TEXT, username TEXT, custom_label TEXT, PRIMARY KEY (flag_key, username))`.catch(() => {})
})

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    await ensureCustomFlagNames()

    const rows = await sql`SELECT flag_key, custom_label FROM custom_flag_names WHERE username = ${(session.user as { username?: string } | undefined)?.username || 'anonymous'}`
    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.flag_key] = r.custom_label
    }
    return success(map)
  } catch (e) {
    return handleError('rename-flag GET', e)
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { flagKey, customLabel } = await req.json()
  if (!flagKey) return badRequest('flagKey required')

  try {
    await ensureCustomFlagNames()

    const username = (session.user as { username?: string } | undefined)?.username || 'anonymous'

    if (!customLabel || customLabel.trim() === '') {
      await sql`DELETE FROM custom_flag_names WHERE flag_key = ${flagKey} AND username = ${username}`
    } else {
      await sql`
        INSERT INTO custom_flag_names (flag_key, username, custom_label) VALUES (${flagKey}, ${username}, ${customLabel.trim()})
        ON CONFLICT (flag_key, username) DO UPDATE SET custom_label = ${customLabel.trim()}
      `
    }

    return success({ ok: true })
  } catch (e) {
    return handleError('rename-flag PATCH', e)
  }
}
