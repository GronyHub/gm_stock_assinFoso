import { requireAuth, badRequest, success } from '@/lib/api'
import { NextRequest } from 'next/server'

// Anything not updated in the last 25s is considered stale (tab closed,
// crashed, navigated away without the unmount cleanup firing) and is
// treated as no-longer-present by the GET below, without needing to
// actively delete it.
const STALE_SECONDS = 25

// Presence used to live in Postgres, hit every 15s by every open tab --
// the single busiest route in the app, and a major driver of Neon compute
// hours (each heartbeat kept the database from ever suspending). Now that
// the app runs as one persistent Node process on a VPS instead of
// disposable serverless functions, this in-memory Map survives perfectly
// well across requests and needs no database at all. Lost on a server
// restart, which is fine -- presence is a live "who's online" nicety, not
// data anyone needs preserved.
const presence = new Map<string, { activity: string; updatedAt: number }>()

export async function GET() {
  const cutoff = Date.now() - STALE_SECONDS * 1000
  const rows = [...presence.entries()]
    .filter(([, v]) => v.updatedAt > cutoff)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .map(([staff_name, v]) => ({ staff_name, activity: v.activity, updated_at: new Date(v.updatedAt).toISOString() }))
  return success(rows)
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const staffName = (session!.user as any)?.username ?? session!.user?.name
  if (!staffName) return badRequest('No identity')

  const { activity } = await req.json()
  if (!activity) return badRequest('Missing activity')

  presence.set(staffName, { activity, updatedAt: Date.now() })
  return success({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const staffName = (session!.user as any)?.username ?? session!.user?.name
  if (staffName) presence.delete(staffName)
  return success({ ok: true })
}
