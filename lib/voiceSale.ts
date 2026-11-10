// Turns what a staff member SAYS ("two passport photos for GM 123", "print 5 pages for man on motor at 2 cedis") into the parts of a Live Sale.
// It only proposes: the staff member sees the result and confirms before anything is recorded.
const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 }
const FILLER = new Set(['for', 'to', 'at', 'a', 'an', 'record', 'sell', 'sold', 'add', 'sale', 'of', 'the', 'please', 'worth', 'i', 'we', 'did', 'done', 'just', 'some', 'pieces', 'piece', 'copies', 'copy', 'x'])

export type VoiceParse = { qty: number; price: number | null; buyer: { kind: 'gm' | 'phone' | 'label' | 'none'; value: string }; query: string }

// "0 2 4 4 1 2 3 4 5 6 7" / "zero two four..." spoken digits become one number.
function squashDigits(t: string): string {
  const w = t.replace(/\b(zero|oh)\b/g, '0').replace(/\b(one|two|three|four|five|six|seven|eight|nine)\b/g, m => String(WORDS[m]))
  return w.replace(/\d(?:\s+\d)+/g, m => m.replace(/\s+/g, ''))
}

// The spoken order is: ITEM, QUANTITY, PRICE, WHO  ("ghana card, 2 pieces, 40 cedis, man in red"). Each part is found by its own words, wherever it is said:
//   quantity: a number with pieces / copies / units / x   ("2 pieces", "five copies", "x3"), else a number near the start of the sentence
//   price:    a number with cedis / ghs / ₵                ("40 cedis", "at 40 cedis each")
//   who:      "GM 123", a 10-digit phone number, "for <label>", or whatever is said AFTER the quantity and price ("man in red")
//   item:     what is left before them
export function parseVoiceSale(raw: string): VoiceParse {
  let t = ' ' + raw.toLowerCase().replace(/[,.!?]/g, ' ').replace(/\s+/g, ' ') + ' '
  const spans: { from: number; to: number }[] = []
  const cut = (m: RegExpMatchArray) => { const from = m.index ?? 0; spans.push({ from, to: from + m[0].length }) }
  let price: number | null = null
  const pm = t.match(/\b(?:(?:at|for|each|price(?: of)?)\s+)?(\d+(?:\.\d+)?)\s*(?:ghana\s+)?(?:cedis?|cedi|ghs?|₵)(?:\s+each)?\b/)
  if (pm) { price = Number(pm[1]); cut(pm) }
  const squashed = squashDigits(t)
  let buyer: VoiceParse['buyer'] = { kind: 'none', value: '' }
  const phone = squashed.match(/\b(0\d{9})\b/)
  const gm = squashed.match(/\b(?:gm|g m|customer(?: number| id)?)\s*(\d{1,6})\b/)
  let qty = 1, qtyDone = false
  const qm = t.match(/\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\s*(?:pieces?|pcs?|copies|copy|units?|of them|x)\b/) ?? t.match(/\bx\s*(\d+)\b/)
  if (qm) { const w = qm[1]; qty = /^\d+$/.test(w) ? Number(w) : (WORDS[w] ?? 1); qtyDone = true; cut(qm) }
  // Who: a customer number or phone first; else the words after the last of quantity/price; else "for <label>".
  if (phone || gm) {
    const g = (phone ?? gm)!
    buyer = phone ? { kind: 'phone', value: g[1] } : { kind: 'gm', value: g[1] }
    t = squashed
    // spans were measured on the unsquashed text: recompute them on the squashed one
    spans.length = 0
    const pm2 = t.match(/\b(?:(?:at|for|each|price(?: of)?)\s+)?(\d+(?:\.\d+)?)\s*(?:ghana\s+)?(?:cedis?|cedi|ghs?|₵)(?:\s+each)?\b/); if (pm2) cut(pm2)
    const qm2 = t.match(/\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\s*(?:pieces?|pcs?|copies|copy|units?|of them|x)\b/); if (qm2) cut(qm2)
    const gm2 = t.match(phone ? /\b0\d{9}\b/ : /\b(?:gm|g m|customer(?: number| id)?)\s*\d{1,6}\b/); if (gm2) cut(gm2)
  } else {
    const after = spans.length ? Math.max(...spans.map(s => s.to)) : -1
    const tail = after >= 0 ? t.slice(after).replace(/^\s*(?:for|to|label(?:led)?)\s+/, '').trim() : ''
    const tp = pm ? t.replace(pm[0], ' '.repeat(pm[0].length)) : t // same length, so positions still line up
    const lb = tp.match(/\b(?:for|to|label(?:led)?)\s+(.+?)\s*$/)
    if (tail) { buyer = { kind: 'label', value: tail.replace(/^(?:the|a|an)\s+/, '').slice(0, 60) }; spans.push({ from: after, to: t.length }) }
    else if (lb && lb[1].trim()) { buyer = { kind: 'label', value: lb[1].trim().replace(/^(?:the|a|an)\s+/, '').slice(0, 60) }; cut(lb) }
  }
  // The item is what is left once the parts above are taken out.
  let rest = ''
  let pos = 0
  for (const sp of [...spans].sort((x, y) => x.from - y.from)) { if (sp.from > pos) rest += t.slice(pos, sp.from) + ' '; pos = Math.max(pos, sp.to) }
  rest += t.slice(pos)
  const toks = rest.trim().split(' ').filter(Boolean)
  if (!qtyDone) {
    const q = toks.findIndex(x => /^\d+$/.test(x) || (x in WORDS && x !== 'a' && x !== 'an'))
    if (q >= 0 && q <= 2) { qty = /^\d+$/.test(toks[q]) ? Number(toks[q]) : WORDS[toks[q]]; toks.splice(q, 1) }
  }
  const query = toks.filter(x => !FILLER.has(x)).join(' ').trim()
  return { qty: Math.max(1, Math.min(500, Math.floor(qty) || 1)), price, buyer, query }
}

export const queryTokens = (q: string) => Array.from(new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 2).map(x => x.length > 3 && x.endsWith('s') ? x.slice(0, -1) : x)))
