import { requireAuth, success, handleError } from '@/lib/api'
import { openFlagCounts } from '@/lib/flagCounts'

// GET -- how many items are open on each flag (the flag laws show it beside their button).
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try { return success(await openFlagCounts()) } catch (e) { return handleError('flag counts', e) }
}
