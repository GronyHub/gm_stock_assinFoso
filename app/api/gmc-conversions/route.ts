import { success, handleError } from '@/lib/api'
import sql from '@/lib/db'

interface ConversionRecord {
  target_item_id: string | number
  date: string
  target_item: string
  quantity: number
}

export async function GET() {
  try {
    const conversions = await sql`
      SELECT
        bl.item_id AS target_item_id,
        b.bill_date::date AS date,
        i.canonical_name AS target_item,
        ABS(bl.quantity::numeric) AS quantity,
        bl.source_pack_item_id,
        sp.canonical_name AS source_pack_name
      FROM bill_lines bl
      JOIN bills b ON bl.bill_id = b.id
      JOIN items i ON bl.item_id = i.id
      LEFT JOIN items sp ON bl.source_pack_item_id = sp.id
      WHERE b.vendor_name = 'Internal Consumption'
        AND bl.quantity < 0
      ORDER BY b.bill_date DESC, bl.item_id
    ` as Array<{
      target_item_id: string | number
      date: string
      target_item: string
      quantity: number
      source_pack_item_id: number | null
      source_pack_name: string | null
    }>

    const packs = await sql`
      SELECT
        converts_to_item_id,
        id,
        canonical_name,
        units_per_pack
      FROM items
      WHERE converts_to_item_id IS NOT NULL
        AND gmc_type = 'pack_to_gmc'
    ` as Array<{ converts_to_item_id: number | null; id: number; canonical_name: string; units_per_pack: number | null }>

    console.log('GMC conversions debug:', {
      conversionsCount: conversions.length,
      conversions: conversions.slice(0, 3),
      packsCount: packs.length,
      packs: packs.slice(0, 3)
    })

    const packsByTarget: Record<string, Array<{ name: string; unitsPerPack: number | null }>> = {}
    packs.forEach(pack => {
      if (!pack.converts_to_item_id) return
      const key = String(pack.converts_to_item_id)
      if (!packsByTarget[key]) {
        packsByTarget[key] = []
      }
      packsByTarget[key].push({
        name: pack.canonical_name,
        unitsPerPack: pack.units_per_pack ? Number(pack.units_per_pack) : null
      })
    })

    const groupedByTarget: Record<string, Array<{ date: string; targetItem: string; quantity: number; sourcePackName: string | null }>> = {}

    conversions.forEach(record => {
      const key = String(record.target_item_id)
      if (!groupedByTarget[key]) {
        groupedByTarget[key] = []
      }

      const qty = Math.abs(Number(record.quantity))

      // Priority 1: Use source_pack_item_id if set (direct tracking)
      let sourcePackName: string | null = null
      if (record.source_pack_name) {
        sourcePackName = record.source_pack_name
      } else {
        // Priority 2: Fall back to quantity matching for older records
        const packList = packsByTarget[key] || []
        // Match packs by comparing quantities; allow small numeric differences
        const matchingPacks = packList.filter(p =>
          p.unitsPerPack !== null && Math.abs(p.unitsPerPack - qty) < 0.01
        )
        if (matchingPacks.length > 0) {
          sourcePackName = matchingPacks.map(p => p.name).join(' / ')
        }

        if (matchingPacks.length === 0 && packList.length > 0) {
          console.log(`No pack match for qty=${qty}, available packs:`, packList.map(p => ({ name: p.name, units: p.unitsPerPack })))
        }
      }

      groupedByTarget[key].push({
        date: record.date,
        targetItem: record.target_item,
        quantity: qty,
        sourcePackName
      })
    })

    return success(groupedByTarget)
  } catch (e) {
    return handleError('gmc-conversions', e)
  }
}
