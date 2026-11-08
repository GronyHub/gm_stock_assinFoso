import { NextRequest, NextResponse } from 'next/server'
import { recordRating } from '@/lib/ratings'

// Public (no login): a customer rates their service from the link in the receipt message. One rating per link.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const b = await req.json().catch(() => ({}))
    const stars = Math.round(Number(b.stars))
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(token) || !(stars >= 1 && stars <= 5)) return NextResponse.json({ error: 'Choose 1 to 5 stars.' }, { status: 400 })
    const comment = typeof b.comment === 'string' && b.comment.trim() ? b.comment.trim().slice(0, 300) : null
    const ok = await recordRating(token, stars, comment)
    return NextResponse.json({ ok })
  } catch (e) {
    console.error('rate POST:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
