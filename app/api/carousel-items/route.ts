import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export const revalidate = 7200 // 2-hour cache

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
    WHERE display_in_carousel = true
    ORDER BY carousel_order ASC, id ASC
  ` as unknown as Array<{
    id: number
    text: string
    carousel_message: string | null
    carousel_order: number | null
    carousel_type: string
  }>

  return NextResponse.json(items.map(item => ({
    id: item.id,
    text: item.carousel_message || item.text,
    icon: item.carousel_type === 'announcement' ? '📢' : item.carousel_type === 'help' ? 'ℹ️' : '📋',
    variant: item.carousel_type === 'announcement' ? 'success' : item.carousel_type === 'help' ? 'info' : 'warning',
  })))
}
