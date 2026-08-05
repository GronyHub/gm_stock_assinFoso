import sql from '@/lib/db'
import { ensureUkTables } from '@/lib/ukTables'
import { NextResponse } from 'next/server'

const ITEMS: { person: string; name: string }[] = [
  { person: 'Grony', name: 'Investment' },
  { person: 'Mina', name: 'Investment' },
  { person: 'Grony', name: 'PF' },
  { person: 'Mina', name: 'PF' },
  { person: 'Grony', name: 'Career' },
  { person: 'Mina', name: 'Career' },
  { person: 'General', name: '198 Casewick' },
]

export async function POST() {
  await ensureUkTables()
  const created: { id: number; person: string; name: string }[] = []
  for (const item of ITEMS) {
    const existing = await sql`SELECT id FROM uk_submenus WHERE person = ${item.person} AND name = ${item.name}`
    if (existing.length > 0) continue
    const [{ next_order }] = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM uk_submenus WHERE person = ${item.person}`
    const [row] = await sql`
      INSERT INTO uk_submenus (person, name, sort_order)
      VALUES (${item.person}, ${item.name}, ${next_order})
      RETURNING id, person, name
    ` as { id: number; person: string; name: string }[]
    created.push(row)
  }
  return NextResponse.json({ createdCount: created.length, created })
}
