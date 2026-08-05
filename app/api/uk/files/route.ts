import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureUkTables } from '@/lib/ukTables'
import { NextRequest, NextResponse } from 'next/server'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json([], { status: 403 })
  await ensureUkTables()

  const submenuId = req.nextUrl.searchParams.get('submenu_id')
  if (!submenuId) return NextResponse.json({ error: 'Missing submenu_id' }, { status: 400 })

  const rows = await sql`
    SELECT id, submenu_id, file_url, file_name, content_type, uploaded_by, uploaded_at
    FROM uk_submenu_files
    WHERE submenu_id = ${Number(submenuId)}
    ORDER BY uploaded_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await ensureUkTables()

  const { submenu_id, file_url, file_name, content_type } = await req.json()
  if (!submenu_id || !file_url || !file_name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const uploadedBy = (session!.user as any)?.username ?? session!.user?.name ?? 'Unknown'
  const [row] = await sql`
    INSERT INTO uk_submenu_files (submenu_id, file_url, file_name, content_type, uploaded_by)
    VALUES (${submenu_id}, ${file_url}, ${file_name}, ${content_type || null}, ${uploadedBy})
    RETURNING id, submenu_id, file_url, file_name, content_type, uploaded_by, uploaded_at
  `
  return NextResponse.json(row, { status: 201 })
}
