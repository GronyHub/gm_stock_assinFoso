import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS custom_view_names (view_key TEXT, username TEXT, custom_label TEXT, PRIMARY KEY (view_key, username))`.catch(() => {})
})


export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  await ensureSchema()

  const rows = await sql`SELECT view_key, custom_label FROM custom_view_names WHERE username = ${(session.user as { username?: string } | undefined)?.username || 'anonymous'}`
  const map: Record<string, string> = {}
  for (const r of rows) {
    map[r.view_key] = r.custom_label
  }
  return NextResponse.json(map)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { viewKey, customLabel } = await req.json()
  if (!viewKey) return NextResponse.json({ error: 'viewKey required' }, { status: 400 })

  await ensureSchema()

  const username = (session.user as { username?: string } | undefined)?.username || 'anonymous'

  if (!customLabel || customLabel.trim() === '') {
    await sql`DELETE FROM custom_view_names WHERE view_key = ${viewKey} AND username = ${username}`
  } else {
    await sql`
      INSERT INTO custom_view_names (view_key, username, custom_label) VALUES (${viewKey}, ${username}, ${customLabel.trim()})
      ON CONFLICT (view_key, username) DO UPDATE SET custom_label = ${customLabel.trim()}
    `
  }

  return NextResponse.json({ ok: true })
}
