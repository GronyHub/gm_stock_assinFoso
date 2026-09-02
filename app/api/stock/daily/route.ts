import { outstandingDailyItems } from '@/lib/countRules'
import { NextResponse } from 'next/server'

let cachedDaily: any = null
let cachedDailyTime = 0
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

export async function GET() {
  const now = Date.now()
  if (cachedDaily && now - cachedDailyTime < CACHE_TTL) {
    return NextResponse.json(cachedDaily)
  }

  const rows = await outstandingDailyItems()
  cachedDaily = rows
  cachedDailyTime = Date.now()
  return NextResponse.json(rows)
}
