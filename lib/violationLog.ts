import { isOwnerLevel } from '@/lib/roles'

// Who may log a violation against whom. The owner and Joe log anyone; Bino may log James only; James logs no one. A violation
// logged by Bino waits for the owner to confirm; one logged by the owner or Joe counts at once.
const LOG_RIGHTS: Record<string, string[]> = { bino: ['james'] }

type U = { role?: string | null; username?: string | null; name?: string | null } | null | undefined
const key = (u: U) => String(u?.username ?? u?.name ?? '').toLowerCase()

export function canLogAgainst(logger: U, target: string): boolean {
  const t = target.toLowerCase()
  if (isOwnerLevel(logger as never)) return t !== key(logger)
  return (LOG_RIGHTS[key(logger)] ?? []).includes(t)
}
export const logsNeedConfirm = (logger: U) => !isOwnerLevel(logger as never)
export const fixedTargets = (logger: U): string[] | null => isOwnerLevel(logger as never) ? null : (LOG_RIGHTS[key(logger)] ?? [])
