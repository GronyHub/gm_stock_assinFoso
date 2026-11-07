import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readFile } from '@/lib/fileStorage'

// Streams a staff display photo (signed-in staff only).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = req.nextUrl.searchParams.get('p')
  if (!p || !p.startsWith('staff-photos/')) return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  try {
    const r = await readFile(p)
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(r.stream, { headers: { 'Content-Type': r.contentType, 'Cache-Control': 'private, max-age=604800' } })
  } catch (e) { console.error('staff photo media:', e); return NextResponse.json({ error: 'Could not load photo' }, { status: 500 }) }
}
