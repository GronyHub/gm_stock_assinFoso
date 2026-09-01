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
        ABS(bl.quantity::numeric) AS quantity
      FROM bill_lines bl
      JOIN bills b ON bl.bill_id = b.id
      JOIN items i ON bl.item_id = i.id
      WHERE b.vendor_name = 'Internal Consumption'
        AND bl.source = 'live_sale'
        AND bl.quantity < 0
      ORDER BY b.bill_date DESC, bl.item_id
    ` as ConversionRecord[]

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
      const packList = packsByTarget[key] || []
      const matchingPacks = packList.filter(p => p.unitsPerPack === qty)
      const sourcePackName = matchingPacks.length > 0
        ? matchingPacks.map(p => p.name).join(' / ')
        : null

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
