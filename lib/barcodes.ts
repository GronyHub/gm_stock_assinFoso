import sql from '@/lib/db'
import { once } from '@/lib/once'

// Barcodes the shop has scanned. None came with the item list, so the app learns them: the first time a barcode is scanned it is linked to an item once
// (search and tap the item), and from then on scanning it finds the item. One item can have several barcodes (a pack and a single unit).
export const ensureBarcodes = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS item_barcodes (
    barcode TEXT PRIMARY KEY, item_id INTEGER NOT NULL, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS item_barcodes_item ON item_barcodes (item_id)`.catch(() => {})
})

// Barcodes are digits and letters only; scanners sometimes add spaces or a leading/trailing control character.
export const cleanBarcode = (raw: unknown) => String(raw ?? '').replace(/[^0-9A-Za-z\-]/g, '').slice(0, 64)
