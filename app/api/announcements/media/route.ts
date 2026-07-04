import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { get } from '@vercel/blob'

// Streams a private announcement blob back to any logged-in staff member --
// matches the Announcements feed's own visibility (everyone can see posts,
// only owner/manager can create/delete them).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathname = req.nextUrl.searchParams.get('p')
  if (!pathname) return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })

  try {
    const result = await get(pathname, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('announcements media fetch error:', e)
    return NextResponse.json({ error: 'Could not load media' }, { status: 500 })
  }
}
