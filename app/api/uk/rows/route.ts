import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { ensureUkTables } from '@/lib/ukTables'
import { NextRequest } from 'next/server'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

// Each row's cells come back as a {columnId: value} map rather than a
// separate array, since the UI keys its inputs by column id anyway.
function shapeRows(rows: { id: number; submenu_id: number; sort_order: number; created_at: string }[],
                    cells: { row_id: number; column_id: number; value: string }[]) {
  return rows.map(r => ({
    ...r,
    values: Object.fromEntries(cells.filter(c => c.row_id === r.id).map(c => [c.column_id, c.value])),
  }))
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isAllowed(session)) return success([])
  await ensureUkTables()

  const submenuId = req.nextUrl.searchParams.get('submenu_id')
  if (!submenuId) return badRequest('Missing submenu_id')

  const rows = await sql`
    SELECT id, submenu_id, sort_order, created_at
    FROM uk_rows
    WHERE submenu_id = ${Number(submenuId)}
    ORDER BY sort_order ASC, id ASC
  `
  const rowIds = rows.map((r: any) => r.id)
  const cells = rowIds.length
    ? await sql`SELECT row_id, column_id, value FROM uk_cells WHERE row_id = ANY(${rowIds})`
    : []
  return success(shapeRows(rows as any, cells as any))
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isAllowed(session)) return badRequest('Forbidden')
  await ensureUkTables()

  const { submenu_id, values } = await req.json()
  if (!submenu_id) return badRequest('Missing submenu_id')

  const [{ next_order }] = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM uk_rows WHERE submenu_id = ${submenu_id}`
  const [row] = await sql`
    INSERT INTO uk_rows (submenu_id, sort_order)
    VALUES (${submenu_id}, ${next_order})
    RETURNING id, submenu_id, sort_order, created_at
  `

  const entries: [string, string][] = values && typeof values === 'object' ? Object.entries(values) : []
  for (const [columnId, value] of entries) {
    const text = typeof value === 'string' ? value : String(value ?? '')
    await sql`INSERT INTO uk_cells (row_id, column_id, value) VALUES (${row.id}, ${Number(columnId)}, ${text})`
  }

  return success({ ...row, values: Object.fromEntries(entries.map(([k, v]) => [Number(k), v])) })
}
