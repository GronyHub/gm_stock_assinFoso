// Shared between item/page.tsx (which needs the resolved order to actually
// render Grony Cash/Manage's rows) and ReorderListsPanel (which edits it) --
// a saved order only ever lists the keys that existed when it was last
// saved, so a newly added feature (or a stale, since-removed one) needs
// graceful handling: unknown-to-the-order items keep their original
// relative position, appended after everything the order does know about,
// rather than the whole list falling back to unordered or crashing on a
// missing lookup.
export function applyPaneOrder<T extends { key: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order || order.length === 0) return items
  const known = new Set(order)
  const ordered = order.map(k => items.find(i => i.key === k)).filter((i): i is T => !!i)
  const rest = items.filter(i => !known.has(i.key))
  return [...ordered, ...rest]
}

export type PaneOrderMap = { cash?: string[]; manage?: string[] }

export type PaneRun<T> = { group?: string; items: T[] }

// Turns a flat, possibly-reordered row list into runs -- each ungrouped row
// is its own one-item run, and every row sharing the same `group` gets
// pulled together into a single run positioned at the first one's spot in
// the sequence (relative order within the group still follows the sequence
// -- reordering one grouped row above another, see ReorderListsPanel, moves
// it within the run). Used to draw one sub-header per group (see
// MANAGE_GROUP_LABELS in manageViewData.ts) without needing the underlying
// list to actually keep a group's rows contiguous. Manage still uses this
// (Advert, Grony 1 to 10 checks); Team merged its one group (Training) back
// into a flat list, so it doesn't need buildPaneRuns/flattenPaneRuns at all
// any more -- see STAFF_TEAM_ITEMS in staffViewData.ts.
export function buildPaneRuns<T extends { key: string; group?: string }>(items: T[]): PaneRun<T>[] {
  const runs: PaneRun<T>[] = []
  const seenGroups = new Set<string>()
  for (const item of items) {
    if (item.group) {
      if (seenGroups.has(item.group)) continue
      seenGroups.add(item.group)
      runs.push({ group: item.group, items: items.filter(i => i.group === item.group) })
    } else {
      runs.push({ items: [item] })
    }
  }
  return runs
}

export type PaneFlatRow<T> = { item: T; header?: string; divider: boolean }

// Flattens buildPaneRuns' output into one render-ready sequence -- each row
// knows whether to draw a group header above it and whether to draw a
// divider line above it (see SidePaneButton's `divider` prop). A header
// counts as the break between it and whatever came before, so the first
// row of a headered run never also gets a divider; neither does the very
// first row of the whole list (nothing above it needs separating from).
// Every other row gets one, so every button reads as visually distinct from
// its neighbor even when several sit under the same header, or none at all.
export function flattenPaneRuns<T>(runs: PaneRun<T>[], groupLabels: Record<string, string>): PaneFlatRow<T>[] {
  const rows: PaneFlatRow<T>[] = []
  let isFirstRow = true
  for (const run of runs) {
    run.items.forEach((item, idx) => {
      const header = idx === 0 && run.group ? groupLabels[run.group] : undefined
      rows.push({ item, header, divider: !isFirstRow && !header })
      isFirstRow = false
    })
  }
  return rows
}
