import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'

export async function requireAuth() {
  const session = await auth()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session }
}

export async function getAuthUser() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user: session.user, session }
}

export function getActorName(session: Session | null): string {
  return session?.user?.username || session?.user?.name || 'Unknown'
}
