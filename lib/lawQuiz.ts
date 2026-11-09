// A short quiz on each law: staff answer, the server marks it, and the mark shows in their signature column.
export type LawQuestion = { q: string; options: string[]; answer: number; why: string }
export function parseQuiz(raw: unknown): LawQuestion[] {
  let v: unknown = raw
  if (typeof raw === 'string') { try { v = JSON.parse(raw) } catch { v = [] } }
  if (!Array.isArray(v)) return []
  return v.filter(x => x && typeof x.q === 'string' && Array.isArray(x.options) && x.options.length >= 2 && Number.isInteger(x.answer))
    .map(x => ({ q: String(x.q), options: x.options.map(String), answer: Number(x.answer), why: String(x.why ?? '') })).slice(0, 6)
}
