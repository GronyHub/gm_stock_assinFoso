import { auth } from '@/lib/auth'
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
  const user = session?.user as any
  if (!user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, session }
}

export function getActorName(session: any): string {
  const user = session?.user as any
  return user?.username || user?.name || 'Unknown'
}
