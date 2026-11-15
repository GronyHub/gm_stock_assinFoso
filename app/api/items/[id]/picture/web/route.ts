import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { saveFile, deleteFile } from '@/lib/fileStorage'
import { ensureItemPictureColumn } from '@/lib/itemPictures'
import { COMMONS_HOSTS } from '@/lib/photoFinder'
import { logActivity } from '@/lib/logger'
import { clearItemsCache } from '@/lib/itemsCache'
import { NextRequest } from 'next/server'
import { thumbPathOf } from '@/lib/itemThumb'

type Ctx = { params: Promise<{ id: string }> }
// Removes a photo and its small copy.
async function removePhotoFiles(path: string) {
  await deleteFile(path).catch(() => {})
  await deleteFile(thumbPathOf(path)).catch(() => {})
}
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// POST { url, page, licence, author } -- a member of staff approved this Wikimedia Commons photo for the item.
// The server downloads it (from Commons' own file host only), keeps a copy like an uploaded photo, and records
// the credit (author, licence, source page) next to it.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureItemPictureColumn()
    const id = Number((await params).id)
    const body = await req.json().catch(() => ({})) as { url?: string; thumb?: string; page?: string; licence?: string; author?: string }
    let src: URL
    try { src = new URL(String(body.url ?? '')) } catch { return badRequest('Bad photo address.') }
    if (src.protocol !== 'https:' || !COMMONS_HOSTS.includes(src.hostname)) return badRequest('Only Wikimedia Commons photos can be attached here.')
    const [item] = await sql`SELECT canonical_name, image_url FROM items WHERE id = ${id}`
    if (!item) return badRequest('Item not found.')
    const r = await fetch(src, { headers: { 'User-Agent': 'GronyStockApp/1.0 (https://app.gronymultimedia.com)' }, signal: AbortSignal.timeout(20000) })
    if (!r.ok) return badRequest(`Could not download the photo (${r.status}).`)
    const type = (r.headers.get('content-type') ?? '').split(';')[0]
    if (!TYPES[type]) return badRequest('That file is not a photo.')
    const blob = await r.blob()
    if (blob.size > 8 * 1024 * 1024) return badRequest('Photo too large.')
    const ts = Date.now()
    const saved = await saveFile(`items/${id}-${ts}.${TYPES[type]}`, blob, type)
    // Commons' own small copy (330 px) for the Live tiles; the tiles fall back to the full photo if this fails.
    try {
      const t = new URL(String(body.thumb ?? ''))
      if (t.protocol === 'https:' && COMMONS_HOSTS.includes(t.hostname)) {
        const tr = await fetch(t, { headers: { 'User-Agent': 'GronyStockApp/1.0 (https://app.gronymultimedia.com)' }, signal: AbortSignal.timeout(15000) })
        const tt = (tr.headers.get('content-type') ?? '').split(';')[0]
        if (tr.ok && TYPES[tt]) { const tb = await tr.blob(); if (tb.size <= 1024 * 1024) await saveFile(`items/${id}-${ts}-t.jpg`, tb, tt) }
      }
    } catch { /* ignore */ }
    const url = `/api/items/picture?p=${encodeURIComponent(saved.pathname)}`
    const credit = [String(body.author ?? '').slice(0, 120) || 'Unknown', String(body.licence ?? '').slice(0, 40), 'Wikimedia Commons', String(body.page ?? '').slice(0, 300)].filter(Boolean).join(' · ')
    await sql`UPDATE items SET image_url = ${url}, image_credit = ${credit} WHERE id = ${id}`
    const old = String(item.image_url ?? '').split('p=')[1]
    if (old) await removePhotoFiles(decodeURIComponent(old))
    clearItemsCache()
    await logActivity(getActorName(session), 'added item photo (Wikimedia Commons)', String(item.canonical_name), 60)
    return success({ image_url: url, image_credit: credit })
  } catch (e) { return handleError('item picture web POST', e) }
}
