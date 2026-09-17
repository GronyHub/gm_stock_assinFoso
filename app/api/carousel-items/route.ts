import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export const revalidate = 3600 // 1-hour cache

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const items = await sql`
    SELECT
      id,
      text,
      carousel_message,
      carousel_order,
      carousel_type
    FROM page_laws
    ORDER BY carousel_order ASC, id ASC
  ` as unknown as Array<{
    id: number
    text: string
    carousel_message: string | null
    carousel_order: number | null
    carousel_type: string
  }>

  // Display all handbook items in carousel (hardcoded to show everything)
  // Filter out completed tasks (those are handled separately)
  const carouselItems = items.map((item, index) => ({
    id: item.id,
    text: item.carousel_message || item.text,
    icon: item.carousel_type === 'announcement' ? '📢' : item.carousel_type === 'help' ? 'ℹ️' : '📋',
    variant: item.carousel_type === 'announcement' ? 'success' : item.carousel_type === 'help' ? 'info' : 'warning',
    order: item.carousel_order ?? index,
  }))

  // Sort by order and return
  return NextResponse.json(carouselItems.sort((a, b) => a.order - b.order))
}
