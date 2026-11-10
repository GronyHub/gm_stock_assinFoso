'use client'

const NUM: Record<string, number> = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
// "zero two four four one two three..." / "0 2 4 4..." -> "0244123..."
export const spokenDigits = (t: string) => t.toLowerCase().replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, m => String(NUM[m])).replace(/[^\d]/g, '')
// "twelve" / "twenty five" / "12 point 5" / "12.5" -> "12.5"
export function spokenNumber(t: string): string {
  const s = t.toLowerCase().replace(/\bpoint\b/g, '.').replace(/[,]/g, '')
  const direct = s.match(/\d+(?:\s*\.\s*\d+)?/)
  if (direct) return direct[0].replace(/\s+/g, '')
  let total = 0, any = false
  for (const w of s.split(/[\s-]+/)) { if (w in NUM) { total += NUM[w]; any = true } else if (w === 'hundred' && any) total *= 100 }
  return any ? String(total) : ''
}

// Kept so existing screens keep their layout: the microphone itself is now the single global button (components/GlobalMic.tsx), always in the same place.
export default function WithMic({ children }: { onText?: (t: string) => void; mode?: 'text' | 'digits' | 'number'; children: React.ReactNode }) {
  return <div className="relative flex-1 min-w-0">{children}</div>
}
