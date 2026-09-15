import { requireAuth, getActorName, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

const AVAILABILITY_VALUES = ['available', 'not_available']
const WORKING_VALUES = ['working', 'not_working']

function describeProperty(name: string, date: string | null) {
  return date ? `${name} on ${String(date).slice(0, 10)}` : name
}

// Updates a property's tracked-asset fields directly on the properties
// table -- these no longer live on expenses/expense_properties, so a
// GMC-drawn property (which never created an expense) can still be marked
// available/working/located same as an externally-bought one.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await req.json() as {
    property_status?: string
    property_type?: string | null
    availability?: 'available' | 'not_available'
    working?: 'working' | 'not_working' | null
    location?: string | null
    notWorkingReason?: string | null
    notAvailableReason?: string | null
  }

  if (body.property_status !== undefined && !['at_shop', 'not_at_shop', 'spoilt'].includes(body.property_status)) {
    return badRequest('Invalid status')
  }
  if (body.availability !== undefined && !AVAILABILITY_VALUES.includes(body.availability)) {
    return badRequest('Invalid availability')
  }
  if (body.working != null && !WORKING_VALUES.includes(body.working)) {
    return badRequest('Invalid working status')
  }

  try {
    const [row] = await sql`
      UPDATE properties SET
        property_status = COALESCE(${body.property_status ?? null}, property_status),
        property_type = CASE WHEN ${body.property_type !== undefined} THEN ${body.property_type ?? null} ELSE property_type END,
        availability = CASE WHEN ${body.availability !== undefined} THEN ${body.availability ?? null} ELSE availability END,
        working = CASE WHEN ${body.working !== undefined} THEN ${body.working ?? null} ELSE working END,
        location = CASE WHEN ${body.location !== undefined} THEN ${body.location ?? null} ELSE location END,
        not_working_reason = CASE WHEN ${body.notWorkingReason !== undefined} THEN ${body.notWorkingReason ?? null} ELSE not_working_reason END,
        not_available_reason = CASE WHEN ${body.notAvailableReason !== undefined} THEN ${body.notAvailableReason ?? null} ELSE not_available_reason END,
        updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING id, name, acquired_date, property_status, property_type, availability, working, location, not_working_reason, not_available_reason
    `
    if (!row) return notFound()

    const parts: string[] = []
    if (body.property_status !== undefined) parts.push(`status → ${body.property_status}`)
    if (body.availability !== undefined) parts.push(body.availability === 'available' ? 'Available' : 'Not Available')
    if (body.working) parts.push(body.working === 'working' ? 'Working' : 'Not Working')
    if (body.location) parts.push(body.location)
    await logActivity(getActorName(session), 'edited property', `${describeProperty(row.name, row.acquired_date)}${parts.length ? ' — ' + parts.join(', ') : ''}`, 600)

    return success(row)
  } catch (e) {
    return handleError('PATCH /api/properties/[id]', e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  try {
    const [row] = await sql`DELETE FROM properties WHERE id = ${Number(id)} RETURNING id, name, acquired_date`
    if (!row) return notFound()

    await logActivity(getActorName(session), 'deleted property', describeProperty(row.name, row.acquired_date))
    return success({ ok: true })
  } catch (e) {
    return handleError('DELETE /api/properties/[id]', e)
  }
}
