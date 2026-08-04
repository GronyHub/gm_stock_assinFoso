// C&H's left-pane row data -- kept separate from Cash/Manage/Staff's own
// (see manageViewData.ts/staffViewData.ts for that split's reasoning) since
// C&H is its own private area with no relationship to any of them.
export type CHView =
  | 'ch_fiifi' | 'ch_kuukua' | 'ch_ebo' | 'ch_odoye'
  | 'ch_inside_house' | 'ch_outside_house' | 'ch_other_land'
  | 'ch_car_to_school' | 'ch_visitors'

export const CH_ITEMS: { key: CHView; label: string; icon: string }[] = [
  { key: 'ch_fiifi', label: 'Fiifi', icon: '👦' },
  { key: 'ch_kuukua', label: 'Kuukua', icon: '👧' },
  { key: 'ch_ebo', label: 'Ebo', icon: '👦' },
  { key: 'ch_odoye', label: 'Odoye', icon: '🧒' },
  { key: 'ch_inside_house', label: 'Inside House', icon: '🏠' },
  { key: 'ch_outside_house', label: 'Outside House', icon: '🌳' },
  { key: 'ch_other_land', label: 'Other Land', icon: '🗺️' },
  { key: 'ch_car_to_school', label: 'Car to school', icon: '🚗' },
  { key: 'ch_visitors', label: 'Visitors', icon: '👥' },
]

// Fiifi/Kuukua/Ebo/Odoye moved here from UK (see git history/ukViewData.ts)
// -- they're C&H's own rows now, but their submenus+tables (Health,
// Education, Behaviour, ...) still live in the exact same uk_submenus/
// uk_columns/uk_rows tables under these same person names, reached through
// the same useUKData hook (see item/page.tsx's `ch` instance) -- moving the
// data would have meant a migration; reusing it needed none, since person
// is just a plain string column, not scoped to which tab reads it. This
// map is what tells the pane/CHTab which of C&H's own rows are one of
// those four (nested submenu list underneath, table content on the right)
// versus a plain single ManageLogPanel page (the other five).
export const CH_CHILD_PERSON: Partial<Record<CHView, 'Fiifi' | 'Kuukua' | 'Ebo' | 'Odoye'>> = {
  ch_fiifi: 'Fiifi', ch_kuukua: 'Kuukua', ch_ebo: 'Ebo', ch_odoye: 'Odoye',
}

// Reverse of the above -- global search's UK-submenu/UK-entry results (see
// item/page.tsx) still come back tagged with a plain `person` string from
// the shared uk_submenus/uk_rows tables, with no way to tell from the API
// response alone that a "Fiifi" result should now open C&H instead of UK.
export const CH_PERSON_VIEW: Record<'Fiifi' | 'Kuukua' | 'Ebo' | 'Odoye', CHView> = {
  Fiifi: 'ch_fiifi', Kuukua: 'ch_kuukua', Ebo: 'ch_ebo', Odoye: 'ch_odoye',
}
