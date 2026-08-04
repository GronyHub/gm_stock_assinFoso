'use client'
import { useState, useEffect } from 'react'

// Manage's left-pane row data + its dynamic (user-added) categories state,
// split out from GronyManageTab.tsx so item/page.tsx can build the merged
// Grony Cash pane and own this state without pulling in (and bundling)
// GronyManageContent's actual content components (ContentPage, TasksView,
// etc.) just to render the list of buttons.
export type ManageView =
  | 'opener' | 'closer'
  | 'audio' | 'audio_status' | 'jingle' | 'equipment' | 'photoshop' | 'whatsapp' | 'cuttings' | 'video' | 'advert_log'
  | 'arrangement' | 'cleanliness' | 'future' | 'customer_display'
  | 'repair_works' | 'quality_assurance'
  | 'properties'

// Simple dated log/checklist categories -- no existing data behind them, so
// each gets a ManageLogPanel (notes + optional photo, viewable as history).
// Staff Display used to be one of these too, but moved to the Team section
// (see STAFF_TEAM_ITEMS in staffViewData.ts) since it's about staff, not
// shop operations -- it's still rendered with a plain ManageLogPanel there,
// just wired up explicitly instead of through this list's catch-all.
export const LOG_CATEGORIES: { key: ManageView; label: string; icon: string }[] = [
  { key: 'arrangement',      label: 'Arrangement',       icon: '🪑' },
  { key: 'cleanliness',      label: 'Cleanliness',       icon: '🧹' },
  { key: 'future',           label: 'Future',            icon: '🔭' },
  { key: 'customer_display', label: 'Customer Display',  icon: '🖼️' },
  { key: 'repair_works',     label: 'Repair Works',      icon: '🔧' },
  { key: 'quality_assurance', label: 'Quality Assurance', icon: '✅' },
]

// The Manage section's fixed contents, top to bottom -- one flat list, no
// nested groups. Home/Daily aren't here -- they're the merged pane's shared
// footer now (see PaneHomeDaily in page.tsx), not Manage-specific rows.
export const MANAGE_LIST_ITEMS: { key: ManageView; label: string; icon?: string }[] = [
  { key: 'opener', label: 'Opener', icon: '🌅' },
  { key: 'closer', label: 'Closer', icon: '🌙' },
  { key: 'audio', label: 'Audio', icon: '🎙️' },
  { key: 'audio_status', label: 'Advert Status', icon: '📋' },
  { key: 'jingle', label: 'Jingle Log', icon: '🎵' },
  { key: 'equipment', label: 'Equipment Check', icon: '🔊' },
  { key: 'photoshop', label: 'Photoshop', icon: '🖌️' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { key: 'cuttings', label: 'Cuttings', icon: '✂️' },
  { key: 'video', label: 'Video', icon: '🎬' },
  { key: 'advert_log', label: 'Daily Log', icon: '📢' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon })),
  { key: 'properties', label: 'Properties', icon: '🏷️' },
]

export type DynamicCategory = { id: number; label: string }

// Icon + fixed left-pane order for each of Manage's "Added by you" categories
// -- these used to be freely add/removable from the pane itself (see git
// history for the old add/remove UI); now they're a hardcoded, curated set
// like MANAGE_LIST_ITEMS' own rows; a new one means asking to have it added
// here, not typing a name into a form. The underlying manage_categories row
// (and its manage_category_tabs content, still fetched by real numeric id --
// see useDynamicManageCategories/DynamicCategoryPage) is untouched by this;
// only the pane's UI for picking one changed. A label with no icon entry
// falls back to a generic folder icon and sorts after every known one,
// rather than silently vanishing, in case a category exists that isn't
// listed here yet.
export const KNOWN_CATEGORY_ICONS: Record<string, string> = {
  'Unfortunate Events': '🚨',
  'Security chk': '🔒',
  'Staff Payments': '💳',
  'App info': 'ℹ️',
}
const KNOWN_CATEGORY_ORDER = Object.keys(KNOWN_CATEGORY_ICONS)

export function orderDynamicCategories(categories: DynamicCategory[]): DynamicCategory[] {
  return [
    ...KNOWN_CATEGORY_ORDER.map(label => categories.find(c => c.label === label)).filter((c): c is DynamicCategory => !!c),
    ...categories.filter(c => !KNOWN_CATEGORY_ORDER.includes(c.label)),
  ]
}

// Owns the fetch lifecycle for Manage's categories -- shared between the
// merged pane (listing them) and GronyManageContent (rendering the active
// one via DynamicCategoryPage). Read-only now -- adding/removing a category
// itself is no longer done from the app (see KNOWN_CATEGORY_ICONS above);
// each category's own tabs (its actual content) are still freely
// add/removable as before, that's unrelated (see DynamicCategoryPage).
export function useDynamicManageCategories() {
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([])
  const [activeDynamicId, setActiveDynamicId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/manage-categories').then(r => r.ok ? r.json() : []).then(d => {
      setDynamicCategories(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }, [])

  return { dynamicCategories, activeDynamicId, setActiveDynamicId }
}
