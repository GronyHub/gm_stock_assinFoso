import sql from '@/lib/db'
import { retireSeed } from '@/lib/seedGuard'

// Deleting a law, everywhere it shows: the law row, its tile(s), its signatures and any group question taken from it. A built-in set it came from is retired so it is never re-made.
export async function deleteLaw(lawId: number): Promise<boolean> {
  const [gone] = await sql`DELETE FROM page_laws WHERE id = ${lawId} RETURNING tile_id, seed`
  if (!gone) return false
  if (gone.tile_id) await sql`UPDATE daily_check_tiles SET active = false, law_id = NULL WHERE id = ${gone.tile_id}`
  await sql`UPDATE daily_check_tiles SET active = false, law_id = NULL WHERE law_id = ${lawId}`.catch(() => {})
  await sql`DELETE FROM law_signatures WHERE law_id = ${lawId}`.catch(() => {})
  await sql`UPDATE question_group_items SET active = FALSE WHERE law_id = ${lawId}`.catch(() => {})
  await retireSeed((gone.seed as string | null) ?? null)
  return true
}
