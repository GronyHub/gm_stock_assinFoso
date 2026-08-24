import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  if (!year || !month) return badRequest('year and month required')

  const rows = await sql`
    SELECT id, staff_name, rota_date::text AS rota_date, sched_in, sched_out, is_off, role
    FROM staff_rota
    WHERE EXTRACT(YEAR FROM rota_date) = ${year}
      AND EXTRACT(MONTH FROM rota_date) = ${month}
    ORDER BY rota_date, staff_name
  `
  return success(rows)
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const { id, sched_in, sched_out, is_off, role } = await req.json()
  const row = await sql`
    UPDATE staff_rota SET sched_in=${sched_in||null}, sched_out=${sched_out||null},
      is_off=${is_off??false}, role=${role||null}
    WHERE id=${id}
    RETURNING id, staff_name, rota_date::text AS rota_date, sched_in, sched_out, is_off, role
  `
  return success(row[0])
}
