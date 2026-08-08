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
  | 'unfortunate_events' | 'security_chk' | 'app_info'
  | 'grony_1' | 'grony_2' | 'grony_3' | 'grony_4' | 'grony_5'
  | 'grony_6' | 'grony_7' | 'grony_8' | 'grony_9' | 'grony_10'

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
  { key: 'grony_1',  label: 'Grony 1',  icon: '1️⃣' },
  { key: 'grony_2',  label: 'Grony 2',  icon: '2️⃣' },
  { key: 'grony_3',  label: 'Grony 3',  icon: '3️⃣' },
  { key: 'grony_4',  label: 'Grony 4',  icon: '4️⃣' },
  { key: 'grony_5',  label: 'Grony 5',  icon: '5️⃣' },
  { key: 'grony_6',  label: 'Grony 6',  icon: '6️⃣' },
  { key: 'grony_7',  label: 'Grony 7',  icon: '7️⃣' },
  { key: 'grony_8',  label: 'Grony 8',  icon: '8️⃣' },
  { key: 'grony_9',  label: 'Grony 9',  icon: '9️⃣' },
  { key: 'grony_10', label: 'Grony 10', icon: '🔟' },
]

// Group -> sub-header label for whichever of MANAGE_LIST_ITEMS' rows below
// carry that `group` tag -- see buildPaneRuns in paneOrder.ts for how a
// group's rows get pulled into one labeled run without needing to actually
// sit next to each other in the underlying (reorderable) list.
export const MANAGE_GROUP_LABELS: Record<string, string> = {
  advert: 'Advert',
  grony_1_to_10: 'GN 1-10 CHK',
}

// Which of LOG_CATEGORIES' rows belong to the "Grony 1 to 10 checks" group
// once spread into MANAGE_LIST_ITEMS below -- kept separate from
// LOG_CATEGORIES itself since that array is also used unmodified for
// GronyManageContent's log-category catch-all (see LOG_CATEGORIES.find
// there), which has no use for a `group` tag.
const LOG_CATEGORY_GROUPS: Partial<Record<ManageView, string>> = {
  arrangement: 'grony_1_to_10',
  customer_display: 'grony_1_to_10',
  repair_works: 'grony_1_to_10',
  grony_1: 'grony_1_to_10',
  grony_2: 'grony_1_to_10',
  grony_3: 'grony_1_to_10',
  grony_4: 'grony_1_to_10',
  grony_5: 'grony_1_to_10',
  grony_6: 'grony_1_to_10',
  grony_7: 'grony_1_to_10',
  grony_8: 'grony_1_to_10',
  grony_9: 'grony_1_to_10',
  grony_10: 'grony_1_to_10',
}

// The Manage section's fixed contents, top to bottom -- one flat list (still
// one reorderable sequence for ReorderListsPanel); `group` just draws a
// shared sub-header above whichever rows carry the same tag (see
// MANAGE_GROUP_LABELS/buildPaneRuns) without changing how reordering works.
// Home/Daily aren't here -- they're the merged pane's shared footer now
// (see PaneHomeDaily in page.tsx), not Manage-specific rows.
export const MANAGE_LIST_ITEMS: { key: ManageView; label: string; icon?: string; group?: string }[] = [
  { key: 'opener', label: 'Opener', icon: '🌅' },
  { key: 'closer', label: 'Closer', icon: '🌙' },
  { key: 'audio', label: 'Audio', icon: '🎙️', group: 'advert' },
  { key: 'audio_status', label: 'Advert Status', icon: '📋', group: 'advert' },
  { key: 'jingle', label: 'Jingle Log', icon: '🎵', group: 'advert' },
  { key: 'equipment', label: 'Equipment Check', icon: '🔊', group: 'advert' },
  { key: 'photoshop', label: 'Photoshop', icon: '🖌️', group: 'advert' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬', group: 'advert' },
  { key: 'cuttings', label: 'Cuttings', icon: '✂️', group: 'advert' },
  { key: 'video', label: 'Video', icon: '🎬', group: 'advert' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon, group: LOG_CATEGORY_GROUPS[c.key] })),
  // 'properties' used to be a row here too -- moved to the Cash pane, right
  // under Expenses (see item/page.tsx), split into its own "Properties at
  // Shop"/"Properties not at Shop" rows. Still a real ManageView (see the
  // type above) and still routed through GronyManageContent -> PropertiesPage
  // exactly as before -- only its pane placement changed, not its content.
  { key: 'unfortunate_events', label: 'Unfortunate Events', icon: '🚨' },
  { key: 'security_chk', label: 'Security chk', icon: '🔒', group: 'grony_1_to_10' },
  { key: 'app_info', label: 'App info', icon: 'ℹ️' },
]

export type DynamicCategory = { id: number; label: string }

// The categories that used to live in their own free-form "Added by you"
// pane section (add/remove a category, pick one, see its tabs -- see git
// history) are now just more fixed rows, split between MANAGE_LIST_ITEMS
// above and STAFF_TEAM_ITEMS (Team Payments, see staffViewData.ts) --
// there's no "Added by you" section left at all. A new one means asking to
// have it added as a fixed row, not typing a name into a form.
//
// Each one's actual content -- its manage_category_tabs (logs/notes/tasks,
// still freely add/removable within the category, see DynamicCategoryPage)
// -- is still keyed by the category's real numeric id underneath, not by
// its fixed pane key, so FIXED_CATEGORY_LABELS below maps each fixed key to
// the real manage_categories.label useFixedCategoryIds fetches and resolves
// an id for at runtime. Team Payments' label is still literally "Staff
// Payments" in the database -- only the pane button/page title were
// renamed, not the underlying row, so no data migration was needed for it
// to move into Team.
export const FIXED_CATEGORY_LABELS: Record<string, string> = {
  unfortunate_events: 'Unfortunate Events',
  security_chk: 'Security chk',
  app_info: 'App info',
  team_payments: 'Staff Payments',
}

// Resolves each of FIXED_CATEGORY_LABELS' real manage_categories.id once on
// mount -- shared between GronyManageContent and StaffContent, whichever of
// them needs to render one of these four via DynamicCategoryPage.
export function useFixedCategoryIds(): Record<string, number> {
  const [byLabel, setByLabel] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch('/api/manage-categories').then(r => r.ok ? r.json() : []).then(d => {
      const rows: DynamicCategory[] = Array.isArray(d) ? d : []
      setByLabel(Object.fromEntries(rows.map(r => [r.label, r.id])))
    }).catch(() => {})
  }, [])
  return byLabel
}
