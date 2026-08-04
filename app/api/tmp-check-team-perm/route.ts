import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const users = await sql`SELECT id, username, role FROM app_users WHERE LOWER(username) IN ('bino', 'james')`
  const roleDefaults = await sql`SELECT role_key, feature_key, allowed FROM role_permissions WHERE feature_key = 'team'`
  const userIds = users.map((u: any) => u.id)
  const overrides = userIds.length
    ? await sql`SELECT user_id, feature_key, allowed FROM user_permissions WHERE feature_key = 'team' AND user_id = ANY(${userIds})`
    : []
  return NextResponse.json({ users, roleDefaults, overrides })
}
