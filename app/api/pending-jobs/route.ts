import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { ensurePendingJobs, pendingJobCounts, selectJobs, JOB_STATUSES, type JobLine } from '@/lib/pendingJobs'
import { NextRequest } from 'next/server'

const cleanLines = (raw: unknown): JobLine[] => (Array.isArray(raw) ? raw : []).map(l => ({
  item_id: Number((l as JobLine).item_id) || null, name: String((l as JobLine).name ?? '').trim().slice(0, 120),
  qty: Math.max(0, Number((l as JobLine).qty) || 0), price: Math.max(0, Number((l as JobLine).price) || 0),
})).filter(l => l.name && l.qty > 0).slice(0, 30)

// GET -- the pending jobs (?status=open|ready|done|all|debt; ?count=1 for just the numbers). Any logged-in staff member.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    if (req.nextUrl.searchParams.get('count')) return success(await pendingJobCounts())
    const st = (req.nextUrl.searchParams.get('status') ?? 'open') as 'open' | 'ready' | 'done' | 'all' | 'debt'
    return success({ jobs: await selectJobs(st) })
  } catch (e) { return handleError('pending-jobs GET', e) }
}

// POST { customer, phone, customer_id?, job?, lines?, due_on?, note?, deposit?: { amount, method }, prepaid?, receipt_id? }
// A customer has left a job. The full amount (the lines) is recorded on the job; only what is paid counts in the Sales Log total; what is left is the
// customer's balance (the debtors list). A job made from a sale already paid in full in the Sales Log (prepaid) owes nothing and adds no money.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePendingJobs()
    const b = await req.json().catch(() => ({}))
    const lines = cleanLines(b.lines)
    const customer = String(b.customer ?? '').trim().slice(0, 120), phone = String(b.phone ?? '').trim().slice(0, 30)
    const job = (String(b.job ?? '').trim() || lines.map(l => `${l.qty} x ${l.name}`).join(', ')).slice(0, 500)
    if (!customer || !phone) return badRequest('A pending job needs the customer and their phone number, so they can be messaged.')
    if (!job) return badRequest('Say what the customer left.')
    const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
    const prepaid = b.prepaid === true
    const dep = Math.max(0, Number(b.deposit?.amount) || 0)
    if (!prepaid && dep > total + 0.005 && total > 0) return badRequest('The deposit is more than the total.')
    const due = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_on ?? '')) ? String(b.due_on) : null
    const by = actorKey(session.user as never)
    const [row] = await sql`INSERT INTO pending_jobs (customer, customer_id, phone, job, lines, total, prepaid, source, receipt_id, due_on, note, created_by, updated_by)
      VALUES (${customer}, ${String(b.customer_id ?? '').trim().slice(0, 20) || null}, ${phone}, ${job}, ${JSON.stringify(lines)}::jsonb, ${total}, ${prepaid}, ${prepaid ? 'sale' : 'job'}, ${Number(b.receipt_id) || null},
              ${due}, ${String(b.note ?? '').trim().slice(0, 500) || null}, ${by}, ${by}) RETURNING id`
    if (!prepaid && dep > 0) await sql`INSERT INTO pending_job_payments (job_id, amount, method, kind, by_staff) VALUES (${row.id}, ${dep}, ${String(b.deposit?.method ?? 'cash').slice(0, 20)}, 'deposit', ${by})`
    void recordActivity(by, prepaid ? 'made a pending job from a paid sale' : 'left a pending job', `${customer}: ${job.slice(0, 80)}${prepaid ? '' : ` (total ${total}, deposit ${dep})`}`)
    const [made] = await selectJobs(row.id as number)
    return success({ id: row.id, job: made }, 201)
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

// DELETE { id } -- remove a job entered by mistake (the owner and Joe). Its payments go with it.
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and Joe remove a job.')
  try {
    await ensurePendingJobs()
    const b = await req.json().catch(() => ({}))
    await sql`DELETE FROM pending_job_payments WHERE job_id = ${Number(b.id)}`
    await sql`DELETE FROM pending_jobs WHERE id = ${Number(b.id)}`
    return success({ ok: true })
  } catch (e) { return handleError('pending-jobs DELETE', e) }
}
