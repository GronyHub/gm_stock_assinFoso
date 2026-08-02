import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const IDS = [87, 54, 152, 175, 174, 57, 213, 60, 173, 138, 172, 171, 53, 151, 169, 170, 58]

export async function GET() {
  const billsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'bills'`

  const bills = await sql`
    SELECT * FROM bills WHERE id = ANY(${IDS}) ORDER BY bill_date
  `

  const activityMentions = await sql`
    SELECT id, staff_name, action, details, created_at FROM activity_logs
    WHERE details ILIKE ANY(${IDS.map((id: number) => `%bill%${id}%`)})
    ORDER BY created_at
  `.catch(() => [])

  // Match activity_logs by bill_number text instead (more reliable than id guesses)
  const billNumbers = (bills as { bill_number: string }[]).map(b => b.bill_number)
  const activityByNumber = await sql`
    SELECT id, staff_name, action, details, created_at FROM activity_logs
    WHERE details ILIKE ANY(${billNumbers.map(n => `%${n}%`)})
    ORDER BY created_at
  `.catch(() => [])

  // Source/entered_by/status patterns -- common cause?
  const sourceBreakdown = await sql`
    SELECT source, status, entered_by, COUNT(*)::int AS n FROM bills WHERE id = ANY(${IDS})
    GROUP BY source, status, entered_by
  `

  return NextResponse.json({ billsCols, bills, activityMentions, activityByNumber, sourceBreakdown })
}
