import { outstandingDailyItems } from '@/lib/countRules'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await outstandingDailyItems()
  return NextResponse.json(rows)
}
