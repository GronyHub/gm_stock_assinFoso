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
