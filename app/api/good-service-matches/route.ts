import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT id, good_name, service_name FROM good_service_matches ORDER BY good_name, service_name
    `
    return success(rows)
  } catch (e) {
    return handleError('good-service-matches GET', e)
  }
}

// POST { good_name, service_name } -- add a single pair
export async function POST(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { good_name, service_name } = await req.json()
  if (!good_name || !service_name) return badRequest('good_name and service_name required')

  try {
    const [row] = await sql`
      INSERT INTO good_service_matches (good_name, service_name)
      VALUES (${good_name}, ${service_name})
      ON CONFLICT (good_name, service_name) DO NOTHING
      RETURNING id, good_name, service_name
    `
    return success(row ?? { ok: true })
  } catch (e) {
    return handleError('good-service-matches POST', e)
  }
}
