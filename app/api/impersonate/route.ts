import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { IMPERSONATE_COOKIE } from '@/lib/impersonate-cookie'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Always check the *real* identity here, since session.user.role/username
// reflect the impersonated target once a "view as" session is active.
function realIdentity(sessionUser: any): { role?: string; username: string } {
  if (!sessionUser) return { username: '' }
  if (sessionUser.impersonating) {
    return { role: sessionUser.realRole, username: (sessionUser.realUsername ?? '').toLowerCase() }
  }
  return { role: sessionUser.role, username: (sessionUser.username ?? sessionUser.name ?? '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const { role, username: myUsername } = realIdentity(session?.user as any)
  const isOwnerLevel = role === 'owner' || myUsername === 'joe'
  if (!isOwnerLevel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username } = await req.json()
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const [target] = await sql`SELECT username, display_name FROM app_users WHERE LOWER(username) = LOWER(${username})`
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, target.username, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  })

  await logActivity(myUsername, 'started viewing portal as', target.username)
  return NextResponse.json({ ok: true, username: target.username, display_name: target.display_name })
}

export async function DELETE() {
  const session = await auth()
  const sessionUser = session?.user as any
  const store = await cookies()
  if (sessionUser?.impersonating) {
    await logActivity(sessionUser.realUsername ?? sessionUser.username, 'stopped viewing portal as', sessionUser.username)
  }
  store.delete(IMPERSONATE_COOKIE)
  return NextResponse.json({ ok: true })
}
