import sql from '@/lib/db'
import { once } from '@/lib/once'

// A display photo per staff login. The file lives in the uploads folder (see lib/fileStorage.ts); the
// app_users row keeps only its address. The address contains a timestamp, so a changed photo gets a new
// address and browsers never show a stale copy.
export const ensureStaffPhotoColumn = once(async () => {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS photo_url TEXT`.catch(() => {})
})
