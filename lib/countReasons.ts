// The reasons an item can be left out of stock counts. Kept apart from lib/countRules.ts because the item edit form (in the browser) needs only this list,
// and countRules.ts talks to the database.
export const COUNT_EXCLUDED_REASONS = [
  { key: 'stopped_ordering', label: 'Stopped ordering from vendor' },
  { key: 'off_market', label: 'No longer available on the market' },
  { key: 'poor_quality', label: 'Poor quality' },
  { key: 'discontinued', label: 'Discontinued by manufacturer' },
  { key: 'replaced', label: 'Replaced by another item' },
  { key: 'seasonal', label: 'Seasonal -- out of season' },
  { key: 'other', label: 'Other' },
] as const
