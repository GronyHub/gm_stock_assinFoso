import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import sql from './db'
import { once } from './once'

// Replaces @vercel/blob (put/get/del) as the storage backend for every
// uploaded attachment -- Sales/Bills receipt photos, UK tab documents,
// Announcements media. That dependency quietly stopped working the moment
// this app moved off Vercel hosting (no BLOB_READ_WRITE_TOKEN on the
// Droplet), so every upload since has silently failed. This writes straight
// to the Droplet's own disk instead, with no third-party service or token
// involved.
//
// Every caller only goes through the three functions below (never touches
// the filesystem or Postgres directly) so that if this ever needs to move
// to a different backend later (S3-compatible storage, etc.), only this one
// file changes -- not every upload/media route built on top of it.
//
// pathname shape is unchanged from the old blob days: "sales/joe-123.jpg",
// "bills/...", "uk/...", "announcements/...".

// Deliberately OUTSIDE /root/app (the git working directory that `git pull`
// and `rm -rf .next` operate on during every deploy) -- uploaded files must
// never sit inside a directory the deploy script rewrites. Override with
// UPLOADS_DIR for local dev, where /root/app-uploads won't exist/be writable.
const BASE_DIR = process.env.UPLOADS_DIR || '/root/app-uploads'

function resolveSafePath(pathname: string): string {
  // pathname always originates from filenames this app itself generated
  // (see the upload routes), never raw user input, but this guards against
  // a malformed or tampered "p" query param trying to escape BASE_DIR
  // (e.g. "../../etc/passwd") before it ever touches the filesystem.
  const full = path.join(BASE_DIR, path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, ''))
  if (full !== BASE_DIR && !full.startsWith(BASE_DIR + path.sep)) {
    throw new Error('Invalid attachment path')
  }
  return full
}

const ensureBackupTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS file_backups (
      pathname TEXT PRIMARY KEY,
      content_type TEXT,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

// The Droplet's disk has no automatic backup the way Neon's database does
// (see AGENTS.md) -- this keeps one extra copy of every uploaded file's raw
// bytes inside Postgres itself, riding along on backups Neon already takes
// care of, at effectively no extra cost for photo-sized attachments. It's a
// safety net only: every real read goes to disk (readFile below), never to
// this table, so it adds no latency to normal use. A failure here never
// blocks the actual upload -- disk is what the user is waiting on.
async function backupToDatabase(pathname: string, contentType: string, data: Buffer) {
  try {
    await ensureBackupTable()
    await sql`
      INSERT INTO file_backups (pathname, content_type, data)
      VALUES (${pathname}, ${contentType}, ${data})
      ON CONFLICT (pathname) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data
    `
  } catch (e) {
    console.error('file_backups insert failed (non-fatal):', pathname, e instanceof Error ? e.message : String(e))
  }
}

export async function saveFile(pathname: string, file: File | Blob, contentType?: string): Promise<{ pathname: string; contentType: string }> {
  const full = resolveSafePath(pathname)
  const buf = Buffer.from(await file.arrayBuffer())
  await fs.promises.mkdir(path.dirname(full), { recursive: true })
  await fs.promises.writeFile(full, buf)
  const resolvedType = contentType || (file as File).type || 'application/octet-stream'
  backupToDatabase(pathname, resolvedType, buf) // fire-and-forget -- see comment above
  return { pathname, contentType: resolvedType }
}

export async function readFile(pathname: string): Promise<{ stream: ReadableStream; contentType: string } | null> {
  const full = resolveSafePath(pathname)
  try {
    const stat = await fs.promises.stat(full)
    if (!stat.isFile()) return null
  } catch {
    return null
  }
  const nodeStream = fs.createReadStream(full)
  return { stream: Readable.toWeb(nodeStream) as ReadableStream, contentType: contentTypeFromExt(full) }
}

export async function deleteFile(pathname: string): Promise<void> {
  const full = resolveSafePath(pathname)
  await fs.promises.unlink(full).catch(() => {})
  await sql`DELETE FROM file_backups WHERE pathname = ${pathname}`.catch(() => {})
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.3gp': 'video/3gpp',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.aac': 'audio/aac',
}
function contentTypeFromExt(fullPath: string): string {
  return EXT_CONTENT_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream'
}
