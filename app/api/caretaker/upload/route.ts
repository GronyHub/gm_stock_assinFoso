import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { saveFile } from '@/lib/fileStorage'
import { canCaretake } from '@/lib/caretaker'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !(await canCaretake(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Photos only (JPG, PNG, WebP)' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Photo too large' }, { status: 400 })
  const name = `caretaker/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`.slice(0, 200)
  try {
    const saved = await saveFile(name, file, file.type)
    return NextResponse.json({ url: `/api/caretaker/media?p=${encodeURIComponent(saved.pathname)}` })
  } catch (e) {
    console.error('caretaker upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
