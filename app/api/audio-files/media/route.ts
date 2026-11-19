import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, badRequest } from '@/lib/api'
import { readFileRange } from '@/lib/fileStorage'

// Plays an audio advert file (any logged-in staff member). Supports Range so the player can seek.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const p = req.nextUrl.searchParams.get('p')
  if (!p || !p.startsWith('audio/')) return badRequest('Bad path')
  try {
    const r = await readFileRange(p, req.headers.get('range'))
    if (!r) return badRequest('Not found')
    const headers: Record<string, string> = { 'Content-Type': r.contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'Content-Length': String(r.end - r.start + 1) }
    if (r.partial) headers['Content-Range'] = `bytes ${r.start}-${r.end}/${r.size}`
    return new NextResponse(r.stream, { status: r.partial ? 206 : 200, headers })
  } catch { return badRequest('Could not load the file') }
}
