import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const unresolvedTotal = await sql`
    SELECT COUNT(*)::int AS cnt FROM bill_lines WHERE item_id IS NULL OR unresolved = true
  `
  const sample = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.item_id, bl.unresolved,
      (SELECT COUNT(*)::int FROM bill_lines bl2 WHERE bl2.bill_id = bl.bill_id AND bl2.item_id IS NOT NULL) AS bill_resolved_lines,
      b.total
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE bl.item_id IS NULL OR bl.unresolved = true
    LIMIT 20
  `
  return NextResponse.json({ unresolvedTotal: unresolvedTotal[0]?.cnt, sample })
}
