import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  await sql`CREATE TABLE IF NOT EXISTS custom_flag_names (flag_key TEXT, username TEXT, custom_label TEXT, PRIMARY KEY (flag_key, username))`.catch(() => {})

  const rows = await sql`SELECT flag_key, custom_label FROM custom_flag_names WHERE username = ${(session.user as { username?: string } | undefined)?.username || 'anonymous'}`
  const map: Record<string, string> = {}
  for (const r of rows) {
    map[r.flag_key] = r.custom_label
  }
  return NextResponse.json(map)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { flagKey, customLabel } = await req.json()
  if (!flagKey) return NextResponse.json({ error: 'flagKey required' }, { status: 400 })

  await sql`CREATE TABLE IF NOT EXISTS custom_flag_names (flag_key TEXT, username TEXT, custom_label TEXT, PRIMARY KEY (flag_key, username))`.catch(() => {})

  const username = (session.user as { username?: string } | undefined)?.username || 'anonymous'

  if (!customLabel || customLabel.trim() === '') {
    await sql`DELETE FROM custom_flag_names WHERE flag_key = ${flagKey} AND username = ${username}`
  } else {
    await sql`
      INSERT INTO custom_flag_names (flag_key, username, custom_label) VALUES (${flagKey}, ${username}, ${customLabel.trim()})
      ON CONFLICT (flag_key, username) DO UPDATE SET custom_label = ${customLabel.trim()}
    `
  }

  return NextResponse.json({ ok: true })
}
