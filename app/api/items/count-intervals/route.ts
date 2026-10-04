import { auth } from '@/lib/auth'
import { itemCountIntervalLabels, formatCountInterval } from '@/lib/countRules'
import { getCached } from '@/lib/cacheStore'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })

  try {
    const intervals = await getCached('items:count-intervals', 300, itemCountIntervalLabels)
    const result: Record<number, string | null> = {}
    for (const [itemId, label] of intervals) {
      result[itemId] = formatCountInterval(label)
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error('count-intervals failed:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({})
  }
}
