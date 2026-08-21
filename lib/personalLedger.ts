import sql from '@/lib/db'
import { once } from '@/lib/once'

// Optional refinement under a category -- currently only used for Children
// (Percy/Prisley/Preston/Princess), but left generic in case another
// category grows one later.
async function ensurePersonalSubcategoryColumnImpl() {
  await sql`ALTER TABLE grony_personal_ledger ADD COLUMN IF NOT EXISTS subcategory TEXT`.catch(() => {})
}

export const ensurePersonalSubcategoryColumn = once(ensurePersonalSubcategoryColumnImpl)
