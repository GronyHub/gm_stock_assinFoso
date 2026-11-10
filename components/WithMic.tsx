'use client'
import { useEffect, useRef, useState } from 'react'

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

// Wraps ONE text box, number box or text area and adds a small microphone to its right: tap it, speak, and the words go into the box (text: added to what is
// there; digits: a phone number; number: a quantity). The staff member still sees and can change the text before saving. Where the phone cannot listen
// the microphone is simply not shown (the keyboard's own microphone still works).
export default function WithMic({ onText, mode = 'text', children }: { onText: (t: string) => void; mode?: 'text' | 'digits' | 'number'; children: React.ReactNode }) {
  const [ok, setOk] = useState(false)
  const [on, setOn] = useState(false)
  const rec = useRef<{ stop: () => void } | null>(null)
  useEffect(() => { setOk(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); return () => { try { rec.current?.stop() } catch { /* ignore */ } } }, []) // eslint-disable-line @typescript-eslint/no-explicit-any
  function go() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SR) return
    const r = new SR(); r.lang = 'en-GB'; r.interimResults = false; r.continuous = false
    r.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const t = String(e.results?.[0]?.[0]?.transcript ?? '').trim()
      if (!t) return
      onText(mode === 'digits' ? spokenDigits(t) : mode === 'number' ? spokenNumber(t) : t)
    }
    r.onend = () => setOn(false); r.onerror = () => setOn(false)
    rec.current = r; setOn(true); try { r.start() } catch { setOn(false) }
  }
  return (
    <div className="relative flex-1 min-w-0 [&>input]:pr-9 [&>textarea]:pr-9">
      {children}
      {ok && <button type="button" onClick={go} title="Speak instead of typing" aria-label="Speak instead of typing"
        className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${on ? 'animate-pulse bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>🎤</button>}
    </div>
  )
}
