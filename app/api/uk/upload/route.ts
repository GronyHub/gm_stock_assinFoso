import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

// Broader than announcements/upload's ALLOWED_TYPES -- investment/PF/career
// documents are as likely to be a PDF or a Word/Excel file as a photo.
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `uk/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`.slice(0, 200) || `uk/${Date.now()}.${ext}`

  try {
    const blob = await put(filename, file, { access: 'private' })
    const url = `/api/uk/media?p=${encodeURIComponent(blob.pathname)}`
    return NextResponse.json({ url, contentType: file.type, fileName: file.name })
  } catch (e) {
    console.error('uk upload error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 })
  }
}
