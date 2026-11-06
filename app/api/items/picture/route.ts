import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readFile } from '@/lib/fileStorage'

// Streams an item photo (signed-in staff only).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = req.nextUrl.searchParams.get('p')
  if (!p || !p.startsWith('items/')) return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  try {
    const r = await readFile(p)
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(r.stream, { headers: { 'Content-Type': r.contentType, 'Cache-Control': 'private, max-age=86400' } })
  } catch (e) { console.error('item picture media:', e); return NextResponse.json({ error: 'Could not load photo' }, { status: 500 }) }
}
