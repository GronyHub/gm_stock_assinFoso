// One-off recovery script -- pulls every file out of the old Vercel Blob
// store (from before this app moved off Vercel hosting) and writes it into
// /root/app-uploads, the exact place lib/fileStorage.ts now reads
// attachments from. Only needed once; safe to re-run (each file is simply
// overwritten with a fresh copy, nothing is deleted from Vercel).
//
// Requires @vercel/blob to actually be installed (it's no longer a project
// dependency) and a real BLOB_READ_WRITE_TOKEN from the frozen Vercel
// project's Storage tab, passed in as VERCEL_BLOB_MIGRATION_TOKEN -- see
// .github/workflows/migrate-attachments.yml, which handles both.
import { list, get } from '@vercel/blob'
import fs from 'fs'
import path from 'path'

const BASE_DIR = process.env.UPLOADS_DIR || '/root/app-uploads'
const token = process.env.VERCEL_BLOB_MIGRATION_TOKEN

if (!token) {
  console.error('VERCEL_BLOB_MIGRATION_TOKEN is not set -- nothing to do.')
  process.exit(1)
}

async function downloadOne(pathname) {
  const result = await get(pathname, { token, access: 'private' })
  if (!result || result.statusCode !== 200) {
    throw new Error(`unexpected statusCode ${result?.statusCode}`)
  }
  const chunks = []
  const reader = result.stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const full = path.join(BASE_DIR, pathname)
  await fs.promises.mkdir(path.dirname(full), { recursive: true })
  await fs.promises.writeFile(full, Buffer.concat(chunks.map(c => Buffer.from(c))))
}

async function main() {
  let cursor
  let total = 0, ok = 0
  const failures = []

  do {
    const res = await list({ token, cursor, limit: 1000 })
    for (const blob of res.blobs) {
      total++
      try {
        await downloadOne(blob.pathname)
        ok++
        console.log(`OK   ${blob.pathname} (${blob.size} bytes)`)
      } catch (e) {
        failures.push(blob.pathname)
        console.error(`FAIL ${blob.pathname} -- ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    cursor = res.hasMore ? res.cursor : undefined
  } while (cursor)

  console.log(`\nDone. ${ok}/${total} files recovered into ${BASE_DIR}.`)
  if (failures.length) {
    console.log(`${failures.length} failed:`)
    for (const p of failures) console.log(' -', p)
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
