import { pendingJobCounts } from '@/lib/pendingJobs'

// Some tasks only exist while something is true. 'pending_jobs': the shop holds open pending jobs. Returns the conditions that are NOT met right now,
// so a task depending on one is left out of the lists and out of the day-end count.
export async function unmetConditions(): Promise<Set<string>> {
  const unmet = new Set<string>()
  try { if ((await pendingJobCounts()).open === 0) unmet.add('pending_jobs') } catch { /* leave the task in */ }
  return unmet
}
