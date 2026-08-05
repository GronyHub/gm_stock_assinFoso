import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf'])
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB -- a photo or scan of a receipt, not a video

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  // Android's file/Drive picker often hands back an empty or generic
  // application/octet-stream MIME type instead of the real one -- fall back
  // to the filename's extension rather than rejecting a perfectly good
  // photo or PDF the browser just didn't label properly.
  if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'Unsupported file type -- attach a photo or PDF of the receipt.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
  }

  const author = (session.user as { username?: string | null }).username ?? session.user.name ?? 'user'
  const filename = `bills/${author}-${Date.now()}.${ext || 'bin'}`

  try {
    // Private-only store, same as sales/announcements -- read back through
    // our own authenticated proxy route (app/api/bills/media) rather than a
    // direct public CDN URL. Raced against a timeout for the same reason
    // sales/upload is: a hung put() otherwise surfaces client-side as a
    // bare "Failed to fetch" with no useful error to show.
    const blob = await Promise.race([
      put(filename, file, { access: 'private' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Upload service timed out, please try again.')), 8000)),
    ])
    const url = `/api/bills/media?p=${encodeURIComponent(blob.pathname)}`
    return NextResponse.json({ url, contentType: blob.contentType || file.type, name: file.name })
  } catch (e) {
    console.error('bills upload error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 })
  }
}
