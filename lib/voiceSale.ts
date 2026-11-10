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

export function parseVoiceSale(raw: string): VoiceParse {
  let t = ' ' + raw.toLowerCase().replace(/[,.!?]/g, ' ').replace(/\s+/g, ' ') + ' '
  let price: number | null = null
  const pm = t.match(/\b(?:at|for|each|price(?: of)?)\s+(\d+(?:\.\d+)?)\s*(?:ghana\s+)?(?:cedis?|ghs?|₵)(?:\s+each)?/)
  if (pm) { price = Number(pm[1]); t = t.replace(pm[0], ' ') }
  const squashed = squashDigits(t)
  let buyer: VoiceParse['buyer'] = { kind: 'none', value: '' }
  const phone = squashed.match(/\b(0\d{9})\b/)
  const gm = squashed.match(/\b(?:gm|g m|customer(?: number| id)?)\s*(\d{1,6})\b/)
  if (phone) { buyer = { kind: 'phone', value: phone[1] }; t = squashed.replace(phone[0], ' ') }
  else if (gm) { buyer = { kind: 'gm', value: gm[1] }; t = squashed.replace(gm[0], ' ') }
  else {
    const lb = t.match(/\b(?:for|to|label(?:led)?)\s+(.+?)\s*$/)
    if (lb && lb[1].trim()) { buyer = { kind: 'label', value: lb[1].trim().replace(/^(?:the|a|an)\s+/, '').slice(0, 60) }; t = t.replace(lb[0], ' ') }
  }
  let qty = 1
  const toks = t.trim().split(' ').filter(Boolean)
  const q = toks.findIndex(x => /^\d+$/.test(x) || (x in WORDS && x !== 'a' && x !== 'an'))
  if (q >= 0 && q <= 2) { qty = /^\d+$/.test(toks[q]) ? Number(toks[q]) : WORDS[toks[q]]; toks.splice(q, 1) }
  else if (toks[0] === 'a' || toks[0] === 'an') toks.shift()
  const query = toks.filter(x => !FILLER.has(x)).join(' ').trim()
  return { qty: Math.max(1, Math.min(500, Math.floor(qty) || 1)), price, buyer, query }
}

export const queryTokens = (q: string) => Array.from(new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 2).map(x => x.length > 3 && x.endsWith('s') ? x.slice(0, -1) : x)))
