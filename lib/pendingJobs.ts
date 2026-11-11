import sql from '@/lib/db'
import { once } from '@/lib/once'

// Pending jobs: jobs customers leave behind (to be done, or done and waiting to be collected). Written by any staff member.
//   pending = left with us, to be done   ready = done, waiting for the customer   done = collected or delivered
export const JOB_STATUSES = ['pending', 'ready', 'done'] as const
export type PendingJob = { id: number; customer: string; phone: string | null; job: string; left_on: string; due_on: string | null; status: string; note: string | null; created_by: string | null; updated_by: string | null; done_at: string | null }

export const ensurePendingJobs = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS pending_jobs (
    id SERIAL PRIMARY KEY, customer TEXT NOT NULL, phone TEXT, job TEXT NOT NULL, left_on DATE NOT NULL DEFAULT CURRENT_DATE, due_on DATE,
    status TEXT NOT NULL DEFAULT 'pending', note TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), done_at TIMESTAMPTZ)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS pending_jobs_status ON pending_jobs (status, due_on)`.catch(() => {})
})

// How many are open, ready to collect, and overdue (due before today and not done).
export async function pendingJobCounts() {
  await ensurePendingJobs()
  const today = new Date().toISOString().slice(0, 10)
  const [r] = await sql`SELECT COUNT(*) FILTER (WHERE status <> 'done')::int AS open, COUNT(*) FILTER (WHERE status = 'ready')::int AS ready,
      COUNT(*) FILTER (WHERE status <> 'done' AND due_on < ${today}::date)::int AS overdue FROM pending_jobs`
  return { open: Number(r?.open ?? 0), ready: Number(r?.ready ?? 0), overdue: Number(r?.overdue ?? 0) }
}
