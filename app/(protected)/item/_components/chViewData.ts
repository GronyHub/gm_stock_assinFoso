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
