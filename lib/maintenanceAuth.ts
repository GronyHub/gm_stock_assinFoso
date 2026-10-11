import { headers } from 'next/headers'

// True only when MAINTENANCE_SECRET is actually configured AND the request
// carries it. Deliberately has no 'dev' fallback (unlike the maintenance
// routes' own check) -- this one unlocks a session-protected read.
export async function isMaintenanceCall(): Promise<boolean> {
  const secret = process.env.MAINTENANCE_SECRET
  if (!secret) return false
  return (await headers()).get('authorization') === `Bearer ${secret}`
}
