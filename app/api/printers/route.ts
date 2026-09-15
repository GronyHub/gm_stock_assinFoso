import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT id, acquired_date AS expense_date, name AS expense_account, vendor_name, amount,
             property_type, availability, working, location,
             not_working_reason, not_available_reason
      FROM properties
      WHERE property_type = 'Printer'
      ORDER BY acquired_date DESC
    `
    return success(rows)
  } catch (e) {
    return handleError('printers GET', e)
  }
}
