// ON/OFF SWITCHES for features the owner can turn off without a code change (Settings > Switches). Stored in app_settings under
// 'featureSwitches' as { key: boolean }; a key that was never set uses its default (on). The server and every screen read the same values.
export type FeatureKey = 'live_who' | 'sale_needs_clockin' | 'presence_question' | 'due_prompt' | 'video_gate' | 'law_question' | 'law_reminder' | 'notify_input' | 'manager_block'
export const FEATURES: { key: FeatureKey; label: string; detail: string; group: string }[] = [
  { key: 'live_who', group: 'Live', label: 'Show the "Who?" box (optional)', detail: 'The optional "Who?" box on each Live tile: a customer, a phone number or a label like "man in white shirt". Filling it is optional; a sale records without it. Off: the box is hidden.' },
  { key: 'sale_needs_clockin', group: 'Live', label: 'Sales only while clocked in', detail: 'Staff can record a sale only while they are clocked in at the shop.' },
  { key: 'presence_question', group: 'Clock', label: 'Presence question at clock-out', detail: '"Is any of the following staff still at the shop?" must be answered before clocking out (your voice recording plays).' },
  { key: 'due_prompt', group: 'Tasks', label: '"It\'s time for ..." prompt', detail: 'When a task of mine falls due, a card asks me to tick it Done, mark it Not required (with a reason) or remind me in 10 minutes.' },
  { key: 'video_gate', group: 'Laws', label: 'Tile videos at login', detail: 'An unwatched tile video is shown after login; it closes when watched to the end, or "Later today" once a day.' },
  { key: 'law_question', group: 'Laws', label: 'Question of the day', detail: 'One question a day from the laws, at the bottom of the screen. A wrong answer shows the law and offers its video.' },
  { key: 'law_reminder', group: 'Laws', label: 'Laws shown at login', detail: 'The laws for the start of work are shown after login and confirmed with "I have read these laws".' },
  { key: 'manager_block', group: 'Clock', label: 'Manager block at the start of the day', detail: 'Joe sees "Before you continue" until the previous day is closed and earlier clock times are decided. He can skip it (you are told); off: it is not shown at all.' },
  { key: 'notify_input', group: 'Notifications', label: 'Notify me of staff answers and ticks', detail: 'A push to Grony and Joe for every task tick, question-group answer, question of the day and presence answer.' },
]
export const SWITCHES_KEY = 'featureSwitches'
export const withDefaults = (v: unknown): Record<FeatureKey, boolean> => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return Object.fromEntries(FEATURES.map(f => [f.key, o[f.key] !== false])) as Record<FeatureKey, boolean>
}
