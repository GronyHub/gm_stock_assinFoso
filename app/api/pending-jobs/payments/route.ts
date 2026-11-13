import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { notifyManagement } from '@/lib/checklistAlerts'
import { ensurePendingJobs, selectJobs } from '@/lib/pendingJobs'
import { NextRequest } from 'next/server'

// GET ?days=45 -- money taken for jobs per day and per staff member (what the Sales Log total adds to the sales).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensurePendingJobs()
    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 45, 1), 400)
    const rows = await sql`SELECT day::text AS day, LOWER(COALESCE(by_staff, '')) AS staff, SUM(amount)::float8 AS amount FROM pending_job_payments WHERE day >= CURRENT_DATE - ${days}::int GROUP BY day, LOWER(COALESCE(by_staff, ''))`
    return success({ payments: rows })
  } catch (e) { return handleError('pending-job-payments GET', e) }
}

// POST { job_id, amount, method?, kind?: 'balance' | 'refund', note? } -- more money taken for a job (or a refund, recorded as a negative amount).
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePendingJobs()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.job_id)
    const [job] = await selectJobs(id)
    if (!job) return badRequest('That job was not found.')
    if (job.prepaid) return badRequest('This job was already paid in full in the Sales Log.')
    const refund = b.kind === 'refund'
    const amt = Math.abs(Number(b.amount) || 0)
    if (!(amt > 0)) return badRequest('Enter the amount.')
    if (!refund && amt > job.balance + 0.005) return badRequest(`The balance is only ${job.balance.toFixed(2)}.`)
    if (refund && amt > job.paid + 0.005) return badRequest(`Only ${job.paid.toFixed(2)} was paid.`)
    const by = actorKey(session.user as never)
    await sql`INSERT INTO pending_job_payments (job_id, amount, method, kind, note, by_staff) VALUES (${id}, ${refund ? -amt : amt}, ${String(b.method ?? 'cash').slice(0, 20)}, ${refund ? 'refund' : 'balance'}, ${String(b.note ?? '').slice(0, 200) || null}, ${by})`
    void notifyManagement(by, `${by.charAt(0).toUpperCase() + by.slice(1)}: ${refund ? 'refund' : 'payment'} on a pending job`, `${job.customer}: ${amt.toFixed(2)}`)
    void recordActivity(by, refund ? 'refunded money on a pending job' : 'took a payment on a pending job', `${job.customer}: ${amt.toFixed(2)}`)
    return success({ job: (await selectJobs(id))[0] })
  } catch (e) { return handleError('pending-job-payments POST', e) }
}
