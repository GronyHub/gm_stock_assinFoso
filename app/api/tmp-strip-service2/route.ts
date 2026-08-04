import sql from '@/lib/db'
import { mergeItems } from '@/lib/mergeItems'
import { NextResponse } from 'next/server'

// 42 clean renames + 1 disambiguated rename (325 -> "A4 Embrossed 2", since
// "A4 Embrossed" already exists as item 104 -- kept separate, not merged,
// per instruction, and left to the existing automatic duplicate-item
// detector to flag for review) + 1 merge (304/384, both literally named
// "Service - Passport Printing (4x6)" already, so stripping alone can't
// disambiguate them -- merged into one instead).
const RENAMES: { id: number; newName: string }[] = [
  { id: 307, newName: 'A4 Brown Envelope singles for sale 2' },
  { id: 327, newName: '10mm Slides' },
  { id: 326, newName: '12mm slides' },
  { id: 316, newName: '14mm Slides' },
  { id: 324, newName: '8mm Slides' },
  { id: 195, newName: 'A3 Sticker Printing (A3 Sticker)' },
  { id: 315, newName: 'A4 Lamination' },
  { id: 204, newName: 'BROCHURE' },
  { id: 111, newName: 'Binding' },
  { id: 323, newName: 'Blue Cardboard' },
  { id: 151, newName: 'CV (A4 sheets)' },
  { id: 275, newName: 'Camera Hire' },
  { id: 255, newName: 'Cartridge Refill' },
  { id: 279, newName: 'DOCUMENT EDITING' },
  { id: 107, newName: 'Design' },
  { id: 242, newName: 'Ghana Card copy' },
  { id: 318, newName: 'Green Cardboard' },
  { id: 87, newName: 'Invitation Cards' },
  { id: 108, newName: 'Invoice Printing' },
  { id: 256, newName: 'Online Reg. - University of Education, Winneba' },
  { id: 244, newName: 'Online Registration - Security Forces' },
  { id: 84, newName: 'Online registration - Ghana Armed Forces' },
  { id: 101, newName: 'Online registration - School Admission' },
  { id: 317, newName: 'PVC Cover' },
  { id: 86, newName: 'Payslip (A4 sheet)' },
  { id: 306, newName: 'Picture Printing (5x7)' },
  { id: 305, newName: 'Picture printing (4 x 6)' },
  { id: 331, newName: 'Pink Cardboard' },
  { id: 179, newName: 'Placement' },
  { id: 88, newName: 'Printing (A4)' },
  { id: 110, newName: 'Receipt book printing' },
  { id: 106, newName: 'Scanning' },
  { id: 270, newName: 'Testimonial (A4)' },
  { id: 85, newName: 'Typing (A4)' },
  { id: 109, newName: 'White DL Envelope printing' },
  { id: 340, newName: 'White envelope DL singles _for envelope printing' },
  { id: 319, newName: 'White envelope DL singles _for sale' },
  { id: 332, newName: 'Yellow Cardboard' },
  { id: 335, newName: 'A3 printing' },
  { id: 336, newName: 'book printing' },
  { id: 338, newName: 'picture editing' },
  { id: 320, newName: 'white dl envelope singles' },
  { id: 325, newName: 'A4 Embrossed 2' },
]

async function renameOne(id: number, newName: string) {
  const [current] = await sql`SELECT canonical_name FROM items WHERE id = ${id}`
  if (!current) return { id, ok: false, error: 'not found' }
  if (current.canonical_name === newName) return { id, ok: true, skipped: true }

  await sql`UPDATE items SET canonical_name = ${newName}, zoho_item_name = ${newName} WHERE id = ${id}`
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${id}, ${current.canonical_name}, 'canonical', 'rename')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  await sql`UPDATE sales_receipt_lines SET resolved_name = ${newName} WHERE item_id = ${id}`
  await sql`UPDATE bill_lines SET resolved_name = ${newName} WHERE item_id = ${id}`
  await sql`UPDATE stock_counts SET item_name = ${newName} WHERE item_id = ${id}`
  return { id, ok: true, from: current.canonical_name, to: newName }
}

export async function POST() {
  const renameResults = []
  for (const { id, newName } of RENAMES) {
    renameResults.push(await renameOne(id, newName))
  }

  let mergeResult
  try {
    mergeResult = await mergeItems(384, 304, 'Passport Printing (4x6)')
  } catch (e) {
    mergeResult = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({ renameResults, mergeResult })
}
