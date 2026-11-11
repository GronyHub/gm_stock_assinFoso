import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { ensurePendingJobs, pendingJobCounts, JOB_STATUSES } from '@/lib/pendingJobs'
import { NextRequest } from 'next/server'

// GET -- the pending jobs (?status=open|ready|done|all; ?count=1 for just the numbers). Any logged-in staff member.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    if (req.nextUrl.searchParams.get('count')) return success(await pendingJobCounts())
    await ensurePendingJobs()
    const st = req.nextUrl.searchParams.get('status') ?? 'open'
    const rows = await sql`SELECT id, customer, phone, job, left_on::text AS left_on, due_on::text AS due_on, status, note, created_by, updated_by, done_at
      FROM pending_jobs
      WHERE (${st} = 'all' OR (${st} = 'open' AND status <> 'done') OR status = ${st})
        AND (status <> 'done' OR done_at > now() - interval '30 days')
      ORDER BY (status = 'done'), due_on NULLS LAST, left_on, id LIMIT 300`
    return success({ jobs: rows })
  } catch (e) { return handleError('pending-jobs GET', e) }
}

// POST { customer, phone?, job, due_on?, note? } -- a customer has left a job.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePendingJobs()
    const b = await req.json().catch(() => ({}))
    const customer = String(b.customer ?? '').trim().slice(0, 120), job = String(b.job ?? '').trim().slice(0, 500)
    if (!customer || !job) return badRequest('Write the customer and what they left.')
    const due = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_on ?? '')) ? String(b.due_on) : null
    const by = actorKey(session.user as never)
    const [row] = await sql`INSERT INTO pending_jobs (customer, phone, job, due_on, note, created_by, updated_by)
      VALUES (${customer}, ${String(b.phone ?? '').trim().slice(0, 30) || null}, ${job}, ${due}, ${String(b.note ?? '').trim().slice(0, 500) || null}, ${by}, ${by}) RETURNING id`
    void recordActivity(by, 'left a pending job', `${customer}: ${job.slice(0, 100)}`)
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('pending-jobs POST', e) }
}

// PATCH { id, status?, note?, due_on?, job?, customer?, phone? } -- move a job along or correct it.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePendingJobs()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.id)
    const [cur] = await sql`SELECT id, customer, job, status FROM pending_jobs WHERE id = ${id}`
    if (!cur) return badRequest('That job was not found.')
    const by = actorKey(session.user as never)
    const status = JOB_STATUSES.includes(b.status) ? String(b.status) : String(cur.status)
    const due = b.due_on === '' ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_on ?? '')) ? String(b.due_on) : undefined
    await sql`UPDATE pending_jobs SET status = ${status}, updated_by = ${by}, updated_at = now(),
        done_at = CASE WHEN ${status} = 'done' THEN COALESCE(done_at, now()) ELSE NULL END,
        note = CASE WHEN ${b.note === undefined} THEN note ELSE ${String(b.note ?? '').trim().slice(0, 500) || null} END,
        due_on = CASE WHEN ${due === undefined} THEN due_on ELSE ${due ?? null}::date END,
        job = COALESCE(${typeof b.job === 'string' && b.job.trim() ? b.job.trim().slice(0, 500) : null}, job),
        customer = COALESCE(${typeof b.customer === 'string' && b.customer.trim() ? b.customer.trim().slice(0, 120) : null}, customer),
        phone = CASE WHEN ${b.phone === undefined} THEN phone ELSE ${String(b.phone ?? '').trim().slice(0, 30) || null} END
      WHERE id = ${id}`
    if (status !== cur.status) void recordActivity(by, status === 'done' ? 'handed over a pending job' : status === 'ready' ? 'finished a pending job' : 'reopened a pending job', `${cur.customer}: ${String(cur.job).slice(0, 100)}`)
    return success({ ok: true })
  } catch (e) { return handleError('pending-jobs PATCH', e) }
}

// DELETE { id } -- remove a job entered by mistake (the owner and Joe).
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and Joe remove a job.')
  try {
    await ensurePendingJobs()
    const b = await req.json().catch(() => ({}))
    await sql`DELETE FROM pending_jobs WHERE id = ${Number(b.id)}`
    return success({ ok: true })
  } catch (e) { return handleError('pending-jobs DELETE', e) }
}
