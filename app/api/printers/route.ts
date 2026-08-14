import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  try {
    const rows = await sql`
      SELECT id, expense_date, expense_account, description, vendor_name, amount,
             is_property, property_type, availability, working, location,
             not_working_reason, not_available_reason
      FROM expenses
      WHERE is_property = true AND property_type = 'Printer'
      ORDER BY expense_date DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('Printers fetch error:', e)
    return NextResponse.json([], { status: 500 })
  }
}
