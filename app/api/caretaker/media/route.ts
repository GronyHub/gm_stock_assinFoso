import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readFile } from '@/lib/fileStorage'
import { canCaretake } from '@/lib/caretaker'

// Streams a caretaker photo back -- only the caretaker role and the owners.
// Children's photos are private, so this is never served without a session.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !canCaretake(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const pathname = req.nextUrl.searchParams.get('p')
  if (!pathname || !pathname.startsWith('caretaker/')) return NextResponse.json({ error: 'Bad path' }, { status: 400 })
  try {
    const result = await readFile(pathname)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(result.stream, { headers: { 'Content-Type': result.contentType, 'Cache-Control': 'private, max-age=3600' } })
  } catch (e) {
    console.error('caretaker media error:', e)
    return NextResponse.json({ error: 'Could not load photo' }, { status: 500 })
  }
}
