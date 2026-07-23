import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const cols = await sql`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name IN ('zoho_bill_id', 'bill_number', 'vendor_id')
  `
  const appBills = await sql`
    SELECT b.id, b.bill_number, COUNT(bl.id) AS line_count
    FROM bills b JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.source = 'app'
    GROUP BY b.id, b.bill_number
    HAVING COUNT(bl.id) > 1
    LIMIT 10
  `
  const appBillsTotal = await sql`SELECT COUNT(*) FROM bills WHERE source = 'app'`
  return NextResponse.json({ cols, multiLineAppBills: appBills, appBillsTotal: appBillsTotal[0] })
}
