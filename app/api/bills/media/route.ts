import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { get } from '@vercel/blob'

// Streams a private bill-attachment blob back to any logged-in staff
// member -- same pattern as app/api/sales/media and app/api/announcements/media.
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
    console.error('bills media fetch error:', e)
    return NextResponse.json({ error: 'Could not load attachment' }, { status: 500 })
  }
}
