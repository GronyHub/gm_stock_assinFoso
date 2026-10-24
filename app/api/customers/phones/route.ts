import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { extraPhones } from '@/lib/customerPhones'
import { NextRequest } from 'next/server'

// GET ?code=GM12 -> that customer's main and extra numbers (for choosing where to send a message).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const code = (req.nextUrl.searchParams.get('code') ?? '').toUpperCase()
    const [c] = await sql`SELECT id, display_name, phone FROM customers WHERE customer_id_code = ${code}`
    if (!c) return success({ main: null, extras: [] })
    return success({ name: c.display_name, main: c.phone, extras: await extraPhones(c.id as number) })
  } catch (e) { return handleError('customers/phones', e) }
}
