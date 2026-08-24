import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureManageLogs } from '@/lib/manageLogs'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import { NextRequest } from 'next/server'

// Daily checklist/log entries for the Grony Manage categories that have no
// existing data behind them (Arrangement, Cleanliness, Future, Customer
// Display, Staff Display, Training, Repair Works, Quality Assurance), plus
// the Advert sub-tab's Jingle Log and Equipment Check categories. Advert's
// own daily "was it played" tracking, Staff (dress code), and Properties
// instead read from the existing closing_reports / expenses data -- see
// ClosingReportLogView and ExpensesTab(initialTab="properties") in
// GronyManageTab.

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return success([])

  const view = req.nextUrl.searchParams.get('view')
  const category = req.nextUrl.searchParams.get('category')

  // Grid view: fetch latest entry for each grony section + check type combination
  if (view === 'grony_checks') {
    try {
      await ensureDbInitialized()
      await ensureManageLogs()
      const rows = await sql`
        SELECT DISTINCT ON (grony_section, category)
          grony_section, category, log_date::text, created_at
        FROM manage_logs
        WHERE category LIKE 'grony_%'
        ORDER BY grony_section, category, log_date DESC, created_at DESC
      `

      const status: Record<number, Record<string, { hasEntry: boolean; lastDate?: string }>> = {}
      for (let i = 1; i <= 10; i++) {
        status[i] = {
          properties: { hasEntry: false },
          cleanliness: { hasEntry: false },
          arrangement: { hasEntry: false },
          repair_works: { hasEntry: false },
          customer_display: { hasEntry: false },
          security: { hasEntry: false },
        }
      }

      rows.forEach((row: any) => {
        const match = row.category.match(/grony_([^_]+)_(\d+)/)
        if (match) {
          const checkType = match[1]
          const gronySection = parseInt(match[2], 10)
          if (status[gronySection]?.[checkType]) {
            status[gronySection][checkType] = {
              hasEntry: true,
              lastDate: new Date(row.log_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
            }
          }
        }
      })

      return success(status)
    } catch (e) {
      console.error('manage-logs grony_checks error:', e)
      return success({})
    }
  }

  // Regular category view
  if (!category) return badRequest('Missing category')

  try {
    await ensureDbInitialized()
    await ensureManageLogs()
    const rows = await sql`
      SELECT id, category, log_date::text, notes, photo_url, logged_by, created_at,
        attendees, start_time::text, end_time::text, grony_section
      FROM manage_logs
      WHERE category = ${category}
      ORDER BY log_date DESC, created_at DESC
      LIMIT 90
    `
    return success(rows)
  } catch (e) {
    console.error('manage-logs GET error:', e)
    return success([])
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { category, notes, photo_url, attendees, start_time, end_time } = await req.json()
  if (!category || typeof category !== 'string') {
    return badRequest('Missing category')
  }
  if (!notes && !photo_url) {
    return badRequest('Add a note or a photo')
  }

  const loggedBy = (session?.user as any)?.username || session?.user?.name || 'Unknown'

  try {
    await ensureDbInitialized()
    await ensureManageLogs()
    const [row] = await sql`
      INSERT INTO manage_logs (category, notes, photo_url, logged_by, attendees, start_time, end_time)
      VALUES (${category}, ${notes || null}, ${photo_url || null}, ${loggedBy},
        ${Array.isArray(attendees) && attendees.length ? attendees : null}, ${start_time || null}, ${end_time || null})
      RETURNING id, category, log_date::text, notes, photo_url, logged_by, created_at,
        attendees, start_time::text, end_time::text
    `
    await logActivity(loggedBy, `logged ${category.replace(/_/g, ' ')}`, notes || '(photo only)')
    return success(row)
  } catch (e) {
    return handleError('manage-logs POST', e)
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return badRequest('Missing id')

  try {
    await sql`DELETE FROM manage_logs WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) {
    return handleError('manage-logs DELETE', e)
  }
}
