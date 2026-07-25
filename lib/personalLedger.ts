import sql from '@/lib/db'

// Optional refinement under a category -- currently only used for Children
// (Percy/Prisley/Preston/Princess), but left generic in case another
// category grows one later.
export async function ensurePersonalSubcategoryColumn() {
  await sql`ALTER TABLE grony_personal_ledger ADD COLUMN IF NOT EXISTS subcategory TEXT`.catch(() => {})
}
