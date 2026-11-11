import sql from '@/lib/db'
import { once } from '@/lib/once'
import { ensureStockOuts } from '@/lib/stockOuts'

// Pending jobs: jobs customers leave behind (to be done, or done and waiting to be collected). Written by any staff member.
//   pending = left with us, to be done   ready = done, waiting for the customer   done = collected or delivered
export const JOB_STATUSES = ['pending', 'ready', 'done'] as const
export type JobLine = { item_id?: number | null; name: string; qty: number; price: number }
export type PendingJob = { id: number; customer: string; customer_id: string | null; phone: string | null; job: string; lines: JobLine[]; total: number; paid: number; balance: number; prepaid: boolean; source: string; receipt_id: number | null; left_on: string; due_on: string | null; status: string; note: string | null; created_by: string | null; updated_by: string | null; done_at: string | null }

export const ensurePendingJobs = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS pending_jobs (
    id SERIAL PRIMARY KEY, customer TEXT NOT NULL, phone TEXT, job TEXT NOT NULL, left_on DATE NOT NULL DEFAULT CURRENT_DATE, due_on DATE,
    status TEXT NOT NULL DEFAULT 'pending', note TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), done_at TIMESTAMPTZ)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS pending_jobs_status ON pending_jobs (status, due_on)`.catch(() => {})
  // The job's items and agreed total, the customer's GM number, whether it was already paid in full in the Sales Log (prepaid: nothing is owed and no payment is added),
  // and where it came from ('job' = left as a pending job, 'sale' = made from a sale already in the Sales Log).
  await sql`ALTER TABLE pending_jobs ADD COLUMN IF NOT EXISTS customer_id TEXT, ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS total NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prepaid BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'job', ADD COLUMN IF NOT EXISTS receipt_id INTEGER`.catch(() => {})
  // Money taken for a job: the deposit when it is left, later balance payments, and refunds (negative). These are what the Sales Log total adds for the day.
  await sql`CREATE TABLE IF NOT EXISTS pending_job_payments (
    id SERIAL PRIMARY KEY, job_id INTEGER NOT NULL, amount NUMERIC NOT NULL, method TEXT, kind TEXT NOT NULL DEFAULT 'deposit', note TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(), day DATE NOT NULL DEFAULT CURRENT_DATE, by_staff TEXT)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS pending_job_payments_day ON pending_job_payments (day, job_id)`.catch(() => {})
  await ensureStockOuts()
})

// How many are open, ready to collect, and overdue (due before today and not done).
export async function pendingJobCounts() {
  await ensurePendingJobs()
  const today = new Date().toISOString().slice(0, 10)
  const [r] = await sql`SELECT COUNT(*) FILTER (WHERE status <> 'done')::int AS open, COUNT(*) FILTER (WHERE status = 'ready')::int AS ready,
      COUNT(*) FILTER (WHERE status <> 'done' AND due_on < ${today}::date)::int AS overdue FROM pending_jobs`
  return { open: Number(r?.open ?? 0), ready: Number(r?.ready ?? 0), overdue: Number(r?.overdue ?? 0) }
}

// The jobs with what has been paid and what is left (a prepaid job owes nothing).
export async function selectJobs(where: 'open' | 'ready' | 'done' | 'all' | 'debt' | number): Promise<PendingJob[]> {
  await ensurePendingJobs()
  const id = typeof where === 'number' ? where : -1, st = typeof where === 'string' ? where : 'all'
  const rows = await sql`SELECT j.id, j.customer, j.customer_id, j.phone, j.job, j.lines, j.total::float8 AS total, j.prepaid, j.source, j.receipt_id,
      COALESCE(p.paid, 0)::float8 AS paid, j.left_on::text AS left_on, j.due_on::text AS due_on, j.status, j.note, j.created_by, j.updated_by, j.done_at
    FROM pending_jobs j LEFT JOIN (SELECT job_id, SUM(amount) AS paid FROM pending_job_payments GROUP BY job_id) p ON p.job_id = j.id
    WHERE (${id} > 0 AND j.id = ${id}) OR (${id} < 0 AND (
        (${st} = 'debt' AND NOT j.prepaid AND j.total - COALESCE(p.paid, 0) > 0.005) OR
        (${st} <> 'debt' AND (${st} = 'all' OR (${st} = 'open' AND j.status <> 'done') OR j.status = ${st}) AND (j.status <> 'done' OR j.done_at > now() - interval '30 days' OR (NOT j.prepaid AND j.total - COALESCE(p.paid, 0) > 0.005)))))
    ORDER BY (j.status = 'done'), j.due_on NULLS LAST, j.left_on, j.id LIMIT 400`
  return rows.map(r => ({ ...r, total: Number(r.total), paid: Number(r.paid), balance: r.prepaid ? 0 : Math.max(0, Number(r.total) - Number(r.paid)), lines: Array.isArray(r.lines) ? r.lines : [] })) as unknown as PendingJob[]
}
