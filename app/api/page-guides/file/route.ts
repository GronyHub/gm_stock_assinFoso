import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readFileRange } from '@/lib/fileStorage'

// Streams an uploaded page guide video, with Range support so it can be seeked and played on iPhones.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = req.nextUrl.searchParams.get('p')
  if (!p || !p.startsWith('guides/')) return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  try {
    const r = await readFileRange(p, req.headers.get('range'))
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const headers: Record<string, string> = {
      'Content-Type': r.contentType, 'Accept-Ranges': 'bytes', 'Content-Length': String(r.end - r.start + 1),
      'Cache-Control': 'private, max-age=86400',
    }
    if (r.partial) headers['Content-Range'] = `bytes ${r.start}-${r.end}/${r.size}`
    return new NextResponse(r.stream, { status: r.partial ? 206 : 200, headers })
  } catch (e) { console.error('page guide file:', e); return NextResponse.json({ error: 'Could not load video' }, { status: 500 }) }
}
