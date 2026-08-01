import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Just the active/inactive flag per username -- deliberately not gated to
// owner-level like /api/users (which also returns email, role, resignation
// reason, etc.). Any logged-in staff member's Times tab needs this to know
// which columns of the shared history grid to hide, same as it already sees
// everyone else's clock times there.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`.catch(() => {})

  try {
    const rows = await sql`SELECT LOWER(username) AS username, active FROM app_users`
    return NextResponse.json(rows)
  } catch (e) {
    console.error('staff/status GET error:', e)
    return NextResponse.json([])
  }
}
