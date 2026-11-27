import { requireAuth, success, handleError } from '@/lib/api'
import { cashConflicts } from '@/lib/cashCount'

// The days where the closing answer and the receipt's Cash Counted are two different figures (for the manager and the owner to choose from).
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try { return success({ rows: await cashConflicts() }) } catch (e) { return handleError('cash-counted conflicts', e) }
}
