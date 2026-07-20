import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureManageLogs } from '@/lib/manageLogs'
import { NextRequest, NextResponse } from 'next/server'

// Daily checklist/log entries for the Grony Manage categories that have no
// existing data behind them (Arrangement, Cleanliness, Future, Customer
// Display, Staff Display, Training, Repair Works, Quality Assurance), plus
// the Advert sub-tab's Jingle Log and Equipment Check categories. Advert's
// own daily "was it played" tracking, Staff (dress code), and Properties
// instead read from the existing closing_reports / expenses data -- see
// ClosingReportLogView and ExpensesTab(initialTab="properties") in
// GronyManageTab.

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const category = req.nextUrl.searchParams.get('category')
  if (!category) return NextResponse.json({ error: 'Missing category' }, { status: 400 })

  try {
    await ensureManageLogs()
    const rows = await sql`
      SELECT id, category, log_date::text, notes, photo_url, logged_by, created_at
      FROM manage_logs
      WHERE category = ${category}
      ORDER BY log_date DESC, created_at DESC
      LIMIT 90
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('manage-logs GET error:', e)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, notes, photo_url } = await req.json()
  if (!category || typeof category !== 'string') {
    return NextResponse.json({ error: 'Missing category' }, { status: 400 })
  }
  if (!notes && !photo_url) {
    return NextResponse.json({ error: 'Add a note or a photo' }, { status: 400 })
  }

  const loggedBy = (session.user as any)?.username || session.user?.name || 'Unknown'

  try {
    await ensureManageLogs()
    const [row] = await sql`
      INSERT INTO manage_logs (category, notes, photo_url, logged_by)
      VALUES (${category}, ${notes || null}, ${photo_url || null}, ${loggedBy})
      RETURNING id, category, log_date::text, notes, photo_url, logged_by, created_at
    `
    await logActivity(loggedBy, `logged ${category.replace(/_/g, ' ')}`, notes || '(photo only)')
    return NextResponse.json(row)
  } catch (e) {
    console.error('manage-logs POST error:', e)
    return NextResponse.json({ error: 'Failed to save log entry' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await sql`DELETE FROM manage_logs WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('manage-logs DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
