import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })
  }

  const author = (session.user as any).username ?? session.user.name ?? 'user'
  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `announcements/${author}-${Date.now()}.${ext}`

  try {
    const blob = await put(filename, file, { access: 'public' })
    return NextResponse.json({ url: blob.url, contentType: file.type })
  } catch (e) {
    console.error('announcements upload error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 })
  }
}
