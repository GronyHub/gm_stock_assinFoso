import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sources = await sql`SELECT DISTINCT source FROM bills`
  const sample = await sql`SELECT id, bill_number, bill_date, vendor_name, total, source FROM bills ORDER BY bill_date LIMIT 5`
  return NextResponse.json({ sources, sample })
}
