import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const IDS = [87, 54, 152, 175, 174, 57, 213, 60, 173, 138, 172, 171, 53, 151, 169, 170, 58]

export async function GET() {
  const out: Record<string, unknown> = {}

  try {
    out.billsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'bills'`
  } catch (e) { out.billsColsError = String(e) }

  let bills: any[] = []
  try {
    bills = await sql`SELECT * FROM bills WHERE id = ANY(${IDS}) ORDER BY bill_date`
    out.bills = bills
  } catch (e) { out.billsError = String(e) }

  try {
    const billNumbers = bills.map((b: any) => b.bill_number)
    const activityByNumber = []
    for (const num of billNumbers) {
      const rows = await sql`
        SELECT id, staff_name, action, details, created_at FROM activity_logs
        WHERE details ILIKE ${'%' + num + '%'} ORDER BY created_at
      `
      if (rows.length) activityByNumber.push(...rows)
    }
    out.activityByNumber = activityByNumber
  } catch (e) { out.activityError = String(e) }

  try {
    out.sourceBreakdown = await sql`
      SELECT source, status, entered_by, COUNT(*)::int AS n FROM bills WHERE id = ANY(${IDS})
      GROUP BY source, status, entered_by
    `
  } catch (e) { out.sourceBreakdownError = String(e) }

  return NextResponse.json(out)
}
