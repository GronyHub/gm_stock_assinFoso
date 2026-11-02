// The Live Sale / Items card list (/api/items/all) is saved briefly to spare the database. Anything that changes
// stock (a count, a bill, a sale, a receipt, a delivery, a merge) clears it, so the next card refresh shows the new
// stock on hand. Kept on globalThis so every route bundle shares the one copy.
type Store = { items: unknown[] | null; at: number }
const g = globalThis as unknown as { __itemsAllCache?: Store }
const store = (): Store => (g.__itemsAllCache ??= { items: null, at: 0 })

export const ITEMS_CACHE_TTL = 10 * 60 * 1000

export function getItemsCache(): unknown[] | null {
  const s = store()
  return s.items && Date.now() - s.at < ITEMS_CACHE_TTL ? s.items : null
}
export function setItemsCache(items: unknown[]) { const s = store(); s.items = items; s.at = Date.now() }
export function clearItemsCache() { const s = store(); s.items = null; s.at = 0 }
