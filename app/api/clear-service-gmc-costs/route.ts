import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'

export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session!.user as any)) return badRequest('Only Grony or Joe can clear costs')

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
      return success({
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

    return success({
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
    return handleError('clear-service-gmc-costs POST', e)
  }
}
