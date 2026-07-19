// A rough sanity check for the one class of mistake that already caused
// real damage: confirming a raw name that clearly says "singles" against a
// "pack" item, or vice versa (see the A4 Brown Envelope Pack investigation
// -- 171 lines silently misrouted by one bad confirmation, because the
// matcher is pure exact-text with no check against what the text implies).
// Text-only heuristic, not exhaustive -- a warning to make someone stop and
// double-check, not a hard block, since real item names can legitimately
// contain either word without conflict.
export function aliasMismatchWarning(rawName: string, itemName: string): string | null {
  const raw = rawName.toLowerCase()
  const item = itemName.toLowerCase()
  const rawSaysSingle = /\bsingles?\b/.test(raw)
  const rawSaysPack = /\bpacks?\b/.test(raw)
  const itemSaysSingle = /\bsingles?\b/.test(item)
  const itemSaysPack = /\bpacks?\b/.test(item)

  if (rawSaysSingle && itemSaysPack && !itemSaysSingle) {
    return `"${rawName}" sounds like a singles item, but "${itemName}" is a pack.`
  }
  if (rawSaysPack && itemSaysSingle && !itemSaysPack) {
    return `"${rawName}" sounds like a pack, but "${itemName}" is a singles item.`
  }
  return null
}
