// What the microphone does with a spoken sentence when no text box is being typed in. A sentence is matched, in this order, to:
//   1. the page you are on (set by that page: Company Laws matches tile names, then law names),
//   2. a destination ("open customers", "go to the daily checklist", "customers page"),
//   3. on Live Sale: a sale ("ghana card, 2 pieces, 40 cedis, man in red"),
//   4. the page's search box (anything else is typed into it),
// and if none of that fits, the microphone says what it heard and that it did not understand.
export type Dest = { label: string; names: string[]; run: () => void }

const NOISE = new Set(['the', 'a', 'an', 'page', 'tab', 'screen', 'section', 'my', 'please', 'to', 'me', 'for', 'of'])
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim()
const words = (t: string) => norm(t).split(' ').filter(w => w && !NOISE.has(w))

export type Verb = { verb: 'open' | 'search' | null; rest: string; explicitPage: boolean }
export function parseVerb(text: string): Verb {
  const t = norm(text)
  const explicitPage = /\b(page|tab|screen)\b/.test(t)
  const m = t.match(/^(?:please\s+)?(?:open|go to|goto|show me|show|take me to|switch to|launch)\s+(.+)$/)
  if (m) return { verb: 'open', rest: m[1], explicitPage: true }
  const s = t.match(/^(?:please\s+)?(?:search for|search|find|look for|look up)\s+(.+)$/)
  if (s) return { verb: 'search', rest: s[1], explicitPage }
  return { verb: null, rest: t, explicitPage }
}

// Best destination whose name words are all said (the longest name wins: "loss by items" beats "items").
export function matchDest(text: string, dests: Dest[]): Dest | null {
  const said = new Set(words(text)), joined = ' ' + words(text).join(' ') + ' '
  let best: { d: Dest; score: number } | null = null
  for (const d of dests) for (const n of d.names) {
    const nw = words(n); if (!nw.length) continue
    const all = nw.every(w => said.has(w) || said.has(w.replace(/s$/, '')) || joined.includes(' ' + w))
    if (!all) continue
    const score = nw.length * 10 - Math.abs(said.size - nw.length)
    if (!best || score > best.score) best = { d, score }
  }
  return best?.d ?? null
}

// Looks for the page's search box (in this document or the page shown in the right pane) and types the words into it.
export function fillSearchBox(doc: Document | null | undefined, text: string): boolean {
  if (!doc) return false
  const cand = Array.from(doc.querySelectorAll('input')).filter(i => {
    const t = (i.getAttribute('type') ?? 'text').toLowerCase(); if (!['text', 'search'].includes(t) || i.disabled || i.readOnly) return false
    const hint = `${i.placeholder} ${i.getAttribute('aria-label') ?? ''} ${i.name}`.toLowerCase(); if (!/search|find|filter|look/.test(hint)) return false
    const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0
  })
  const el = cand[0]; if (!el) return false
  const proto = el.ownerDocument.defaultView!.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, text)
  el.dispatchEvent(new (el.ownerDocument.defaultView!.Event)('input', { bubbles: true }))
  el.focus()
  return true
}
