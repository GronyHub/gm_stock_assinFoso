import { requireAuth, success } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const packs = await sql`
    SELECT
      pack.id,
      pack.canonical_name AS pack_name,
      pack.cf_group AS pack_group,
      pack.units_per_pack,
      pack.unit_name,
      single.canonical_name AS single_item_name,
      single.cf_group AS single_item_group
    FROM items pack
    LEFT JOIN items single ON single.id = pack.converts_to_item_id
    WHERE pack.units_per_pack > 0
      AND pack.converts_to_item_id IS NOT NULL
    ORDER BY pack.cf_group NULLS LAST, pack.canonical_name
  `

  return success(packs)
}
