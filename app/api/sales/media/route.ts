import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, badRequest } from '@/lib/api'
import { get } from '@vercel/blob'

// Streams a private sales-attachment blob back to any logged-in staff
// member -- same pattern as app/api/announcements/media.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const pathname = req.nextUrl.searchParams.get('p')
  if (!pathname) return badRequest('Missing pathname')

  try {
    const result = await get(pathname, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      return badRequest('Not found')
    }
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('sales media fetch error:', e)
    return badRequest('Could not load attachment')
  }
}
