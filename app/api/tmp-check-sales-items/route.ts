import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, canonical_name, product_type, status
    FROM items
    WHERE canonical_name ILIKE '%ink%' OR canonical_name ILIKE '%toner%' OR canonical_name ILIKE '%drum%'
       OR canonical_name ILIKE '%cartridge%' OR canonical_name ILIKE '%cable%' OR canonical_name ILIKE '%battery%'
       OR canonical_name ILIKE '%memory%' OR canonical_name ILIKE '%pin%' OR canonical_name ILIKE '%charger%'
       OR canonical_name ILIKE '%framing%' OR canonical_name ILIKE '%photo%' OR canonical_name ILIKE '%epson%'
       OR canonical_name ILIKE '%canon%' OR canonical_name ILIKE '%hp %' OR canonical_name ILIKE '%blade%'
       OR canonical_name ILIKE '%drive%' OR canonical_name ILIKE '%mouse%' OR canonical_name ILIKE '%lenovo%'
       OR canonical_name ILIKE '%acer%' OR canonical_name ILIKE '%toshiba%' OR canonical_name ILIKE '%dv4%'
    ORDER BY canonical_name
  `
  return NextResponse.json({ count: rows.length, rows })
}
