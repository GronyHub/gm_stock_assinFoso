import sql from '@/lib/db'

export async function GET() {
  try {
    const packs = await sql`
      SELECT
        i.id,
        i.canonical_name as item_name,
        i.gmc_type,
        i.product_type,
        i.units_per_pack,
        i.converts_to_item_id,
        CASE
          WHEN i.converts_to_item_id IS NOT NULL THEN
            (SELECT canonical_name FROM items WHERE id = i.converts_to_item_id)
          ELSE NULL
        END as converts_to_name
      FROM items i
      WHERE (i.gmc_type = 'pack_to_gmc' OR i.gmc_type = 'service_using_gmc')
        AND i.converts_to_item_id IS NOT NULL
      ORDER BY i.product_type, i.canonical_name
    `
    return Response.json(packs)
  } catch (e) {
    return Response.json({ error: 'Failed to fetch GMC packs' }, { status: 500 })
  }
}
