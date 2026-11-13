import type { Duty } from '@/lib/duties'

// THE one rule for whose list a duty is on, used by Waiting for team (when a person is chosen) AND by Waiting for me / a person's page. Waiting for me is Waiting for team cut down to one person,
// so both must call this and nothing else: a duty that falls on someone is on their list, and a duty meant for everyone (a one-off, a weekly law, a pending job, a standing item with no named person) is on every list.
export const fallsOn = (d: Duty, person: string): boolean =>
  !person || d.owner === person || (d.owner === null && (d.kind === 'oneoff' || d.kind === 'periodic' || d.kind === 'job' || d.kind === 'standing'))
