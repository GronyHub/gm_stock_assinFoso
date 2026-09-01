import { success, handleError } from '@/lib/api'
import sql from '@/lib/db'

interface ConversionRecord {
  target_item_id: string | number
  date: string
  target_item: string
  quantity: number
}

interface PackConfig {
  item_name: string
  units_per_pack: number | null
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
        converts_to_item_id AS target_item_id,
        item_name,
        units_per_pack,
        gmc_type
      FROM gmc_packs
      WHERE gmc_type IN ('pack_to_gmc', 'service_using_gmc')
    ` as Array<{ target_item_id: string | number; item_name: string; units_per_pack: number | null; gmc_type: string }>

    const packsByTarget: Record<string, PackConfig[]> = {}
    packs.forEach(pack => {
      const key = String(pack.target_item_id)
      if (!packsByTarget[key]) {
        packsByTarget[key] = []
      }
      packsByTarget[key].push({
        item_name: pack.item_name,
        units_per_pack: pack.units_per_pack
      })
    })

    const groupedByTarget: Record<string, Array<{ date: string; targetItem: string; quantity: number; sourcePackName: string | null }>> = {}

    conversions.forEach(record => {
      const key = String(record.target_item_id)
      if (!groupedByTarget[key]) {
        groupedByTarget[key] = []
      }

      const packConfigs = packsByTarget[key] || []
      const qty = Math.abs(Number(record.quantity))
      const matchingPacks = packConfigs.filter(p => p.units_per_pack === qty)
      const sourcePackName = matchingPacks.length > 0
        ? matchingPacks.map(p => p.item_name).join(' / ')
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
