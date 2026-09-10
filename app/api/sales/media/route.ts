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
    // TEMP diagnostic -- attachments are coming back "Could not load" for
    // everyone and it isn't clear why (missing/invalid BLOB_READ_WRITE_TOKEN
    // after the Vercel migration? a suspended/deleted blob store?). Surface
    // the real error instead of a generic message. Revert once understood.
    const name = e instanceof Error ? e.constructor.name : typeof e
    const message = e instanceof Error ? e.message : String(e)
    console.error('sales/media GET error:', name, message)
    return NextResponse.json({ error: 'Could not load attachment', debugName: name, debugMessage: message, hasToken: !!process.env.BLOB_READ_WRITE_TOKEN }, { status: 400 })
  }
}
