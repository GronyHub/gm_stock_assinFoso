// Who is responsible for deciding a staff member's clock time: Joe decides Bino's and James's, Grony decides Joe's. After 48 hours unanswered it is overdue, and the owner is told.
export const decider = (staff: string) => (staff.toLowerCase() === 'joe' ? 'Grony' : 'Joe')
export const OVERDUE_HOURS = 48
export function waited(requestedAt: string): { hours: number; text: string; overdue: boolean } {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 3600000))
  return { hours, text: hours < 1 ? 'just now' : hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} days`, overdue: hours >= OVERDUE_HOURS }
}
