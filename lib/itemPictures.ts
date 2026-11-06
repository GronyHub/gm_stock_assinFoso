import sql from '@/lib/db'
import { once } from '@/lib/once'

// A photo per item (shown on the item page and used in the advert videos). The file lives in the uploads folder
// (see lib/fileStorage.ts); the items row keeps the address. image_credit holds the author / licence / source page
// for a photo taken from Wikimedia Commons (see lib/photoFinder.ts), so the credit can be shown wherever it is used.
export const ensureItemPictureColumn = once(async () => {
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url TEXT`.catch(() => {})
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS image_credit TEXT`.catch(() => {})
})
