import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, badRequest } from '@/lib/api'
import { readFile } from '@/lib/fileStorage'

// Streams a private sales-attachment file back to any logged-in staff
// member -- same pattern as app/api/announcements/media.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const pathname = req.nextUrl.searchParams.get('p')
  if (!pathname) return badRequest('Missing pathname')

  try {
    const result = await readFile(pathname)
    if (!result) return badRequest('Not found')
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    return badRequest('Could not load attachment')
  }
}
