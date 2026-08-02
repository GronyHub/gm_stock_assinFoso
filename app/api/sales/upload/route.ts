import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB -- a photo or scan of a paper form, not a video

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type -- attach a photo or PDF of the form.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
  }

  const author = (session.user as { username?: string | null }).username ?? session.user.name ?? 'user'
  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `sales/${author}-${Date.now()}.${ext}`

  try {
    // Private-only store, same as announcements -- read back through our own
    // authenticated proxy route (app/api/sales/media) rather than a direct
    // public CDN URL.
    const blob = await put(filename, file, { access: 'private' })
    const url = `/api/sales/media?p=${encodeURIComponent(blob.pathname)}`
    return NextResponse.json({ url, contentType: file.type, name: file.name })
  } catch (e) {
    console.error('sales upload error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 })
  }
}
