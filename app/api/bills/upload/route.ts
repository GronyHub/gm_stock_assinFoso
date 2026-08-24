import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { put } from '@vercel/blob'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf'])
const MAX_SIZE = 20 * 1024 * 1024

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!session?.user) return badRequest('Unauthorized')

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return badRequest('No file')

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.has(ext)) {
    return badRequest('Unsupported file type -- attach a photo or PDF of the receipt.')
  }
  if (file.size > MAX_SIZE) {
    return badRequest('File too large (max 20 MB)')
  }

  const author = (session.user as { username?: string | null }).username ?? session.user.name ?? 'user'
  const filename = `bills/${author}-${Date.now()}.${ext || 'bin'}`

  try {
    const blob = await Promise.race([
      put(filename, file, { access: 'private' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Upload service timed out, please try again.')), 8000)),
    ])
    const url = `/api/bills/media?p=${encodeURIComponent(blob.pathname)}`
    return success({ url, contentType: blob.contentType || file.type, name: file.name })
  } catch (e) {
    return handleError('bills/upload', e)
  }
}
