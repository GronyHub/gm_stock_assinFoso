import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readFile } from '@/lib/fileStorage'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

// Streams a private UK file back -- gated to grony only, same as every
// other /api/uk/* route, since this is real private user data.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pathname = req.nextUrl.searchParams.get('p')
  if (!pathname) return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })

  try {
    const result = await readFile(pathname)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('uk media fetch error:', e)
    return NextResponse.json({ error: 'Could not load media' }, { status: 500 })
  }
}
