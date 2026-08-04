import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Bino (id 3) and James (id 5) currently have an explicit user_permissions
// override of allowed=false for 'team' -- flip both to true, same upsert
// /api/user-permissions' own PATCH handler uses.
export async function POST() {
  const targets = [3, 5]
  for (const userId of targets) {
    await sql`
      INSERT INTO user_permissions (user_id, feature_key, allowed)
      VALUES (${userId}, 'team', true)
      ON CONFLICT (user_id, feature_key) DO UPDATE SET allowed = true
    `
  }
  const after = await sql`
    SELECT u.id, u.username, p.feature_key, p.allowed
    FROM app_users u JOIN user_permissions p ON p.user_id = u.id
    WHERE u.id = ANY(${targets}) AND p.feature_key = 'team'
  `
  return NextResponse.json({ ok: true, after })
}
