import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { saveFile, deleteFile } from '@/lib/fileStorage'
import { ensureItemPictureColumn } from '@/lib/itemPictures'
import { logActivity } from '@/lib/logger'
import { clearItemsCache } from '@/lib/itemsCache'
import { NextRequest } from 'next/server'
import { thumbPathOf } from '@/lib/itemThumb'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
// Removes a photo and its small copy.
async function removePhotoFiles(path: string) {
  await deleteFile(path).catch(() => {})
  await deleteFile(thumbPathOf(path)).catch(() => {})
}
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureItemPictureColumn()
    const [row] = await sql`SELECT image_url, image_credit FROM items WHERE id = ${Number((await params).id)}`
    return success({ image_url: (row?.image_url as string | null) ?? null, image_credit: (row?.image_credit as string | null) ?? null })
  } catch (e) { return handleError('item picture GET', e) }
}

// POST multipart { file } -- sets (or replaces) the item's photo.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureItemPictureColumn()
    const id = Number((await params).id)
    const [item] = await sql`SELECT canonical_name, image_url FROM items WHERE id = ${id}`
    if (!item) return badRequest('Item not found.')
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return badRequest('No photo sent.')
    if (!ALLOWED.includes(file.type)) return badRequest('Photos only (JPG, PNG or WebP).')
    if (file.size > 8 * 1024 * 1024) return badRequest('Photo too large (8 MB at most).')
    const ts = Date.now()
    const saved = await saveFile(`items/${id}-${ts}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`, file, file.type)
    // The phone also sends a small copy for the Live tiles; the tiles fall back to the full photo if it is missing.
    const thumb = form.get('thumb') as File | null
    if (thumb && ALLOWED.includes(thumb.type) && thumb.size <= 1024 * 1024) await saveFile(`items/${id}-${ts}-t.jpg`, thumb, thumb.type).catch(() => {})
    const url = `/api/items/picture?p=${encodeURIComponent(saved.pathname)}`
    await sql`UPDATE items SET image_url = ${url}, image_credit = NULL WHERE id = ${id}`
    const old = String(item.image_url ?? '').split('p=')[1]
    if (old) await removePhotoFiles(decodeURIComponent(old))
    clearItemsCache()
    await logActivity(getActorName(session), 'added item photo', String(item.canonical_name), 60)
    return success({ image_url: url })
  } catch (e) { return handleError('item picture POST', e) }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureItemPictureColumn()
    const id = Number((await params).id)
    const [item] = await sql`SELECT image_url FROM items WHERE id = ${id}`
    await sql`UPDATE items SET image_url = NULL, image_credit = NULL WHERE id = ${id}`
    const old = String(item?.image_url ?? '').split('p=')[1]
    if (old) await removePhotoFiles(decodeURIComponent(old))
    clearItemsCache()
    return success({ ok: true })
  } catch (e) { return handleError('item picture DELETE', e) }
}
