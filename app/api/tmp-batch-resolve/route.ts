import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const PLACEHOLDER_ITEM_ID = 426 // "Goods - Unspecified (Pre-Zoho)"
// Jul 11, 2025 tail notes sitting on top of the already-itemized order
const TAIL_NOTE_LINE_IDS = [435, 436, 437, 438] // Christina order-4=32, Data Appcom Ghana=8, Lucky order=20", Gentle order=10
const HUMBLE_LINE_ID = 508 // "Goods from Humble Beginning = 5390", 2025-10-13, no itemized detail found
const HUMBLE_NOTE = 'Goods from Humble Beginning = 5390 — ⚠ ERROR: item names not found, needs manual resolution'

export async function GET() {
  const tailNotes = await sql`
    SELECT id, bill_id, raw_item_name, item_id, resolved_name, unresolved
    FROM bill_lines WHERE id = ANY(${TAIL_NOTE_LINE_IDS})
  `
  const humble = await sql`
    SELECT id, bill_id, raw_item_name, item_id, resolved_name, unresolved
    FROM bill_lines WHERE id = ${HUMBLE_LINE_ID}
  `
  return NextResponse.json({ tailNotes, humble })
}

export async function POST() {
  try {
    const resolved = await sql`
      UPDATE bill_lines
      SET item_id = ${PLACEHOLDER_ITEM_ID}, resolved_name = 'Goods - Unspecified (Pre-Zoho)', unresolved = false
      WHERE id = ANY(${TAIL_NOTE_LINE_IDS})
      RETURNING id, bill_id, raw_item_name
    `
    const noted = await sql`
      UPDATE bill_lines
      SET resolved_name = ${HUMBLE_NOTE}, unresolved = true
      WHERE id = ${HUMBLE_LINE_ID}
      RETURNING id, bill_id, raw_item_name, resolved_name
    `
    return NextResponse.json({ resolved, noted })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
