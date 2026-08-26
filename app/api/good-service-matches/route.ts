import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  // Optional ?name= scopes this down to just the pairs involving one item,
  // instead of every good/service match in the system -- same reasoning as
  // aliases/wide's ?itemId=, for the same caller (opening a single item
  // shouldn't cost a full-table fetch). Unscoped default is unchanged.
  const name = req.nextUrl.searchParams.get('name')

  try {
    const rows = name
      ? await sql`
          SELECT id, good_name, service_name FROM good_service_matches
          WHERE LOWER(TRIM(good_name)) = LOWER(TRIM(${name})) OR LOWER(TRIM(service_name)) = LOWER(TRIM(${name}))
          ORDER BY good_name, service_name
        `
      : await sql`
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
