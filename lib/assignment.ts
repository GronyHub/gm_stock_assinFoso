import { isManagerName } from '@/lib/signers'

// Who performs a recurring law's task. A law's "Who does it" decides it; its checklist tile carries the same value.
//   all      every staff member clocked in that day
//   managers only the managers clocked in (Grony, Joe, Bino)
//   opener   the first person to clock in that day
//   closer   the last person to clock out that day (while people are still in, any of them may do it)
export const ASSIGNMENTS = [
  { key: 'all', label: 'Everyone clocked in' },
  { key: 'managers', label: 'Managers only' },
  { key: 'opener', label: 'The Opener (first in)' },
  { key: 'closer', label: 'The Closer (last out)' },
] as const
export type Assignment = typeof ASSIGNMENTS[number]['key']
export const cleanAssignment = (v: unknown): Assignment => (ASSIGNMENTS.some(a => a.key === v) ? v as Assignment : 'all')

// Does this person carry a task with this assignment today? `closer` is only known once people clock out; until then everyone still in may do it.
export function owes(assignment: string | null | undefined, name: string, ctx: { opener: string | null; lastOut: string | null }): boolean {
  const n = name.toLowerCase()
  if (assignment === 'managers') return isManagerName(n)
  if (assignment === 'opener') return ctx.opener == null || ctx.opener === n
  if (assignment === 'closer') return ctx.lastOut == null || ctx.lastOut === n
  return true
}
