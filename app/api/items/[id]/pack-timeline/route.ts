import { auth } from '@/lib/auth'
import { buildPackTimeline } from '@/lib/packTimeline'
import { NextResponse } from 'next/server'

// Item 360's Pack Timeline section (LossTab.tsx, shown on a GMC target's own
// page) -- see lib/packTimeline.ts for what this actually computes and why
// it's separate from the existing day-grained Loss/Gain data.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const { id } = await params
  const entries = await buildPackTimeline(Number(id))
  return NextResponse.json(entries)
}
