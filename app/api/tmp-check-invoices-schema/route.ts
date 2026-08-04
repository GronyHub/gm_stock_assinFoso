import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'invoices' ORDER BY ordinal_position
  `
  const sample = await sql`SELECT id, invoice_number, invoice_date FROM invoices ORDER BY id DESC LIMIT 5`
  return NextResponse.json({ cols, sample })
}
