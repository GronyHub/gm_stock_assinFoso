import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { saveFile, deleteFile } from '@/lib/fileStorage'
import { ensureStaffPhotoColumn } from '@/lib/staffPhotos'
import { invalidateCache } from '@/lib/cacheStore'
import { NextRequest } from 'next/server'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

function oldPath(url: unknown): string | null {
  const p = String(url ?? '').split('p=')[1]
  return p ? decodeURIComponent(p) : null
}

// Always the signed-in person's own photo -- nobody changes someone else's.
// POST multipart { file } sets or replaces it; DELETE removes it.
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureStaffPhotoColumn()
    const file = (await req.formData()).get('file') as File | null
    if (!file) return badRequest('No photo sent.')
    if (!ALLOWED.includes(file.type)) return badRequest('Photos only (JPG, PNG or WebP).')
    if (file.size > 8 * 1024 * 1024) return badRequest('Photo too large (8 MB at most).')
    const [me] = await sql`SELECT photo_url FROM app_users WHERE id = ${user.id}`
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const saved = await saveFile(`staff-photos/${user.id}-${Date.now()}.${ext}`, file, file.type)
    const url = `/api/staff/photo?p=${encodeURIComponent(saved.pathname)}`
    await sql`UPDATE app_users SET photo_url = ${url} WHERE id = ${user.id}`
    const old = oldPath(me?.photo_url)
    if (old) await deleteFile(old).catch(() => {})
    invalidateCache('staff:status')
    return success({ photo_url: url })
  } catch (e) { return handleError('profile photo POST', e) }
}

export async function DELETE() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureStaffPhotoColumn()
    const [me] = await sql`SELECT photo_url FROM app_users WHERE id = ${user.id}`
    await sql`UPDATE app_users SET photo_url = NULL WHERE id = ${user.id}`
    const old = oldPath(me?.photo_url)
    if (old) await deleteFile(old).catch(() => {})
    invalidateCache('staff:status')
    return success({ ok: true })
  } catch (e) { return handleError('profile photo DELETE', e) }
}
