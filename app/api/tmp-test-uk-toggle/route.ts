import sql from '@/lib/db'
import { getUserPermissionsMap } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function POST() {
  const [joe] = await sql`SELECT id FROM app_users WHERE username = 'joe'`
  const joeId = joe.id

  const beforeMap = await getUserPermissionsMap()
  const beforeUk = beforeMap['joe']?.['uk']

  // Same upsert the real PATCH /api/user-permissions route runs
  await sql`
    INSERT INTO user_permissions (user_id, feature_key, allowed)
    VALUES (${joeId}, 'uk', true)
    ON CONFLICT (user_id, feature_key) DO UPDATE SET allowed = true
  `
  const afterOnMap = await getUserPermissionsMap()
  const afterOnUk = afterOnMap['joe']?.['uk']

  // Revert -- remove the override entirely so Joe's uk goes back to
  // whatever it was before this test (no row = falls back to role default)
  await sql`DELETE FROM user_permissions WHERE user_id = ${joeId} AND feature_key = 'uk'`

  const afterRevertMap = await getUserPermissionsMap()
  const afterRevertUk = afterRevertMap['joe']?.['uk']

  return NextResponse.json({ beforeUk, afterOnUk, afterRevertUk })
}
