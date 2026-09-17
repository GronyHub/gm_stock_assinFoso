import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export const revalidate = 3600 // 1-hour cache

// Reword long text to fit on a single line (max ~120 chars)
function shortenMessage(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text

  // Try to find a good break point (end of a sentence or clause)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let result = ''

  for (const sentence of sentences) {
    if ((result + sentence).length <= maxLength) {
      result += sentence
    } else {
      break
    }
  }

  if (result) return result.trim()

  // If no good sentence break, truncate at word boundary and add key info
  const words = text.split(' ')
  result = ''
  for (const word of words) {
    if ((result + ' ' + word).length > maxLength - 3) break
    result += ' ' + word
  }

  return result.trim() + '...'
}

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
  // Reword long messages to fit on a single line
  const carouselItems = items.map((item, index) => ({
    id: item.id,
    text: shortenMessage(item.carousel_message || item.text),
    icon: item.carousel_type === 'announcement' ? '📢' : item.carousel_type === 'help' ? 'ℹ️' : '📋',
    variant: item.carousel_type === 'announcement' ? 'success' : item.carousel_type === 'help' ? 'info' : 'warning',
    order: item.carousel_order ?? index,
  }))

  // Sort by order and return
  return NextResponse.json(carouselItems.sort((a, b) => a.order - b.order))
}
