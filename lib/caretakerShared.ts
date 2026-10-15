// Client-safe definitions for the Caretaker area of C&H (no database imports).
// Times are GMT/UTC -- Ghana has no daylight saving, so shop time == UTC.

export const CHILDREN = ['Fiifi', 'Kuukua', 'Ebo', 'Odoye'] as const
export type Child = typeof CHILDREN[number]

export type EventKind =
  | 'wake' | 'health' | 'meal' | 'behaviour' | 'school_need' | 'homework'
  | 'skin' | 'hair' | 'activity' | 'night' | 'house'

export type CareEvent = {
  id: number
  child: string | null
  kind: EventKind
  value: string | null
  note: string | null
  photo_url: string | null
  extra: Record<string, unknown> | null
  recorded_by: string
  recorded_at: string
}

// One-tap options per record type. `note: true` = offer an optional note box,
// `photo: true` = offer an optional photo.
export const OPTIONS: Record<string, { label: string; values: string[]; note?: boolean; photo?: boolean }> = {
  health:      { label: 'Health', values: ['Fine', 'Fever', 'Cough / cold', 'Stomach ache', 'Headache', 'Injury', 'Vomiting', 'Other'], note: true, photo: true },
  meal:        { label: 'Food given', values: ['Breakfast', 'Lunch', 'Supper', 'Snack', 'Drink'], note: true, photo: true },
  behaviour:   { label: 'Negative behaviour', values: ['Fighting', 'Disobedience', 'Rudeness', 'Lying', 'Tantrum', 'Wasting food', 'Other'], note: true, photo: false },
  school_need: { label: 'Needs at school', values: ['Item / book', 'Money', 'Uniform', 'Message from teacher', 'Other'], note: true, photo: true },
  skin:        { label: 'Skin check', values: ['OK', 'Rash', 'Bruise', 'Cut / wound', 'Dry / ashy', 'Other'], note: true, photo: true },
  hair:        { label: 'Hair check', values: ['Neat', 'Bushy', 'Needs combing / plaiting'], note: true, photo: false },
}

export const ACTIVITIES = ['Walk', 'Cooking', 'Cleaning together', 'Games', 'Reading', 'Homework help', 'Watching TV together', 'Prayers', 'Singing', 'Other']

export const HOUSE_AREAS = [
  'Living room', 'Corridor', 'Kitchen', 'Master bedroom', 'Master bath & toilet',
  'General bath & toilet', "Beatrice's room", 'Outside & exits',
] as const
// Areas that need a photo to prove no cobwebs.
export const PHOTO_AREAS = new Set<string>(['Master bath & toilet', 'General bath & toilet'])

export const NIGHT_SLOTS = ['22:00', '01:00', '04:00'] as const
export const NIGHT_CHECKS: { key: string; label: string; good?: boolean }[] = [
  { key: 'slept_well', label: 'Sleeping well', good: true },
  { key: 'restless', label: 'Restless / cannot sleep' },
  { key: 'toilet_help', label: 'Taken to toilet' },
  { key: 'wet_bed', label: 'Bed wet' },
  { key: 'fan_reduced', label: 'Fan reduced' },
  { key: 'covered', label: 'Covered (mosquitoes / cold)' },
  { key: 'posture_fixed', label: 'Posture corrected' },
]

// Rules the caretaker ticks each day. `weekdayPeriods` = when the children are
// home on school days; weekends use all three periods.
export const PERIODS = ['Morning', 'Afternoon', 'Evening'] as const
export function periodsFor(date: Date): readonly string[] {
  const d = date.getUTCDay()
  return d === 0 || d === 6 ? PERIODS : ['Morning', 'Evening']
}
export function isSchoolDay(date: Date) {
  const d = date.getUTCDay()
  return d >= 1 && d <= 5
}

// Day boundaries are Ghana (UTC) calendar days.
export function dayKey(d = new Date()) { return d.toISOString().slice(0, 10) }
