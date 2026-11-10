// The penalty-point rules in ONE place (pure data: safe to import from screens and from the server). Change a number here and every screen,
// push message and the sanction logic follow. (The Sanctions law's own text is a database seed and must be edited in Company Laws.)
export const TIERS = [
  { points: 20, days: 3, hours: 10, label: '3-day suspension' },
  { points: 30, days: 7, hours: 20, label: '1-week suspension' },
  { points: 50, days: 0, hours: 0, label: 'Dismissal' },
] as const
export const WARN_AT = [10, 15]
export const FADE_POINTS = 5
export const FADE_DAYS = 7
export const MISSED_DAILY_CAP = 3
export const LEARNING_DAYS = 14

export const tierLabel = (points: number) => { const t = [...TIERS].reverse().find(x => points >= x.points) ?? TIERS[0]; return t.hours ? `${t.label}, ${t.hours} hours deducted` : t.label }
// "20 = 3-day suspension, 30 = 1-week suspension, 50 = Dismissal"
export const tiersText = () => TIERS.map(t => `${t.points} = ${t.label}`).join(', ')
export const firstTier = TIERS[0]
