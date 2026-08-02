import sql from '@/lib/db'
import { mergeItems } from '@/lib/mergeItems'
import { NextResponse } from 'next/server'

async function snapshot(ids: number[]) {
  return sql`
    SELECT i.id, i.canonical_name, i.status, s.calculated_soh
    FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.id = ANY(${ids})
  `
}

export async function GET() {
  const ids = [117, 205, 379, 273]
  const mainList = await sql`
    SELECT s.item_id AS id, COALESCE(i.canonical_name, s.item_name) AS canonical_name
    FROM item_stock_summary s LEFT JOIN items i ON i.id = s.item_id
    WHERE s.item_id = ANY(${ids})
  `
  return NextResponse.json({ stillLeaking: mainList })
}

export async function POST() {
  const results: unknown[] = []

  // 1. StrInk 26A Toner Cartidge -> 26A Toner Cartridge
  {
    const before = await snapshot([117, 121])
    const result = await mergeItems(117, 121)
    const after = await snapshot([117, 121])
    results.push({ step: '26A toner', loserId: 117, winnerId: 121, before, result, after })
  }

  // 2. PVC COVER BLUE singles + PVC Cover Singles -> A4 PVC CLEAR SINGLES,
  // renamed to "A4 PVC Cover Singles"
  {
    const before = await snapshot([205, 379, 282])
    const r1 = await mergeItems(205, 282)
    const r2 = await mergeItems(379, 282, 'A4 PVC Cover Singles')
    const after = await snapshot([205, 379, 282])
    results.push({ step: 'PVC cover singles 3-way', loserIds: [205, 379], winnerId: 282, before, r1, r2, after })
  }

  // 3. A4 260 One Side Singles for Inv. Cards -> Service - Invitation Cards
  {
    const before = await snapshot([273, 87])
    const result = await mergeItems(273, 87)
    const after = await snapshot([273, 87])
    results.push({ step: 'invitation cards', loserId: 273, winnerId: 87, before, result, after })
  }

  return NextResponse.json(results)
}
