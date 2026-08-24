import { success } from '@/lib/api'

export async function POST() {
  return success({
    error: 'This endpoint is deprecated. Daily sales are automatically consolidated in analytics.',
  })
}
