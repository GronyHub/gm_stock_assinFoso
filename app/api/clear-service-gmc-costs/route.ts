import sql from '@/lib/db'
import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can clear costs' }, { status: 403 })
  }

  try {
    // Find services using GMC with non-null cost_price
    const services = await sql`
      SELECT id, canonical_name, purchase_rate
      FROM items
      WHERE gmc_type = 'service_using_gmc'
        AND purchase_rate IS NOT NULL
        AND status IS NULL
    `

    if (services.length === 0) {
      return NextResponse.json({
        success: true,
        cleared: 0,
        message: 'No services with cost prices found',
      })
    }

    // Clear the cost prices
    await sql`
      UPDATE items
      SET purchase_rate = NULL
      WHERE gmc_type = 'service_using_gmc'
        AND purchase_rate IS NOT NULL
        AND status IS NULL
    `

    return NextResponse.json({
      success: true,
      cleared: services.length,
      services: services.map(s => ({
        id: s.id,
        name: s.canonical_name,
        cost_price_cleared: s.purchase_rate,
      })),
      message: `Cleared cost prices from ${services.length} service${services.length !== 1 ? 's' : ''}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
