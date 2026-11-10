// Every prompt can be put off, so nothing ever stops someone recording a sale or doing their work. A put-off prompt comes back after the time given.
export function isSnoozed(key: string): boolean { try { return Date.now() < Number(localStorage.getItem(key) ?? 0) } catch { return false } }
export function snooze(key: string, minutes: number) { try { localStorage.setItem(key, String(Date.now() + minutes * 60 * 1000)) } catch { /* private mode: it just returns after a refresh */ } }
