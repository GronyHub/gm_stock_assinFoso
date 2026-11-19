import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import { isManagerName } from '@/lib/signers'
import { saveFile, deleteFile } from '@/lib/fileStorage'
import { recordActivity } from '@/lib/logger'

// The audio adverts' files (Manage > Audio Adverts > Files): jingles, voiceovers and the roadside adverts. Stored on the Droplet's disk like every other upload.
const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS audio_files (id SERIAL PRIMARY KEY, name TEXT NOT NULL, pathname TEXT NOT NULL, content_type TEXT, size_bytes BIGINT, uploaded_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
})
const MAX = 60 * 1024 * 1024
const OK_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|amr|mp4)$/i
const mayManage = (u: never) => isOwnerLevel(u) || isManagerName(actorKey(u))

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensure()
    const rows = await sql`SELECT id, name, pathname, content_type, size_bytes::float AS size, uploaded_by, created_at FROM audio_files ORDER BY created_at DESC, id DESC LIMIT 500`
    return success({ files: rows.map(r => ({ ...r, url: `/api/audio-files/media?p=${encodeURIComponent(String(r.pathname))}` })) })
  } catch (e) { return handleError('audio-files GET', e) }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!mayManage(session.user as never)) return badRequest('Only Joe, Bino or Grony can add audio files.')
  try {
    await ensure()
    const form = await req.formData()
    const files = form.getAll('file').filter((f): f is File => typeof f !== 'string')
    if (!files.length) return badRequest('Choose an audio file.')
    const by = actorKey(session.user as never)
    const saved: string[] = []
    for (const f of files) {
      if (!(f.type.startsWith('audio/') || OK_EXT.test(f.name))) return badRequest(`${f.name} is not an audio file.`)
      if (f.size > MAX) return badRequest(`${f.name} is too large (60 MB at most).`)
      const clean = f.name.replace(/[^a-zA-Z0-9._ -]/g, '_')
      const pathname = `audio/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${clean}`.slice(0, 200)
      await saveFile(pathname, f, f.type || undefined, { backup: f.size < 8 * 1024 * 1024 })
      await sql`INSERT INTO audio_files (name, pathname, content_type, size_bytes, uploaded_by) VALUES (${clean.replace(/\.[^.]+$/, '')}, ${pathname}, ${f.type || null}, ${f.size}, ${by})`
      saved.push(clean)
    }
    void recordActivity(by, 'added audio file', saved.join(', ').slice(0, 200))
    return success({ ok: true, saved })
  } catch (e) { return handleError('audio-files POST', e) }
}

// Rename: a file is named by the actual service it advertises (the law says so).
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!mayManage(session.user as never)) return badRequest('Only Joe, Bino or Grony can rename audio files.')
  try {
    await ensure()
    const b = await req.json().catch(() => ({}))
    const name = String(b.name ?? '').trim().slice(0, 120)
    if (!Number(b.id) || name.length < 2) return badRequest('Write the new name.')
    await sql`UPDATE audio_files SET name = ${name} WHERE id = ${Number(b.id)}`
    return success({ ok: true })
  } catch (e) { return handleError('audio-files PATCH', e) }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe or Grony can delete audio files.')
  try {
    await ensure()
    const id = Number(req.nextUrl.searchParams.get('id'))
    const [r] = await sql`DELETE FROM audio_files WHERE id = ${id} RETURNING pathname, name`
    if (r) { await deleteFile(String(r.pathname)); void recordActivity(actorKey(session.user as never), 'deleted audio file', String(r.name)) }
    return success({ ok: true })
  } catch (e) { return handleError('audio-files DELETE', e) }
}
