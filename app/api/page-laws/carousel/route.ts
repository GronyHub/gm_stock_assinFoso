import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, display_in_carousel, carousel_message, carousel_order, carousel_type } = await req.json()

  if (id === undefined) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    if (display_in_carousel !== undefined) {
      await sql`UPDATE page_laws SET display_in_carousel = ${display_in_carousel} WHERE id = ${id}`
    }
    if (carousel_message !== undefined) {
      await sql`UPDATE page_laws SET carousel_message = ${carousel_message} WHERE id = ${id}`
    }
    if (carousel_order !== undefined) {
      await sql`UPDATE page_laws SET carousel_order = ${carousel_order} WHERE id = ${id}`
    }
    if (carousel_type !== undefined) {
      await sql`UPDATE page_laws SET carousel_type = ${carousel_type} WHERE id = ${id}`
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update carousel settings:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
