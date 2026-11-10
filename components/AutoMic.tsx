'use client'
import { useEffect, useRef, useState } from 'react'
import { spokenDigits, spokenNumber } from '@/components/WithMic'

// A small 🎤 appears on the corner of whichever text, number, phone or search box is being typed in, on every page. Tap it and speak: the words go into that box
// (text is added to what is there; a number box takes a spoken number; a phone box takes spoken digits). The person still sees the words and can fix them before saving.
// Boxes that already carry their own microphone (WithMic), passwords, dates, times and files are left alone.
const SKIP_TYPES = new Set(['password', 'date', 'time', 'datetime-local', 'month', 'week', 'file', 'checkbox', 'radio', 'range', 'color', 'hidden', 'submit', 'button', 'email', 'url'])
type SR = { start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; interimResults: boolean; continuous: boolean } // eslint-disable-line @typescript-eslint/no-explicit-any

function eligible(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled && !el.closest('[data-withmic]')
  if (!(el instanceof HTMLInputElement)) return false
  return !SKIP_TYPES.has(el.type) && !el.readOnly && !el.disabled && !el.closest('[data-withmic]') && el.getAttribute('data-nomic') == null
}
function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v) // so the page's own onChange (React) sees it
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function AutoMic() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [on, setOn] = useState(false)
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const rec = useRef<SR | null>(null)
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    if (!supported) return
    const place = () => { const el = field.current; if (!el || !el.isConnected) { setPos(null); return } const r = el.getBoundingClientRect(); if (r.width < 28 || r.bottom < 0 || r.top > window.innerHeight) { setPos(null); return } setPos({ x: Math.min(r.right, window.innerWidth) - 14, y: Math.max(r.top, 0) - 12 }) }
    const focusIn = (e: FocusEvent) => { if (hide.current) clearTimeout(hide.current); if (eligible(e.target as Element)) { field.current = e.target as HTMLInputElement; place() } }
    const focusOut = () => { hide.current = setTimeout(() => { if (!on) { field.current = null; setPos(null) } }, 400) }
    window.addEventListener('focusin', focusIn); window.addEventListener('focusout', focusOut)
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place)
    return () => { window.removeEventListener('focusin', focusIn); window.removeEventListener('focusout', focusOut); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [supported, on])

  function go() {
    const el = field.current
    const SRc = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!el || !SRc) return
    if (on) { try { rec.current?.stop() } catch { /* ignore */ } return }
    const r: SR = new SRc(); r.lang = 'en-GB'; r.interimResults = false; r.continuous = false
    r.onresult = e => {
      const t = String(e.results?.[0]?.[0]?.transcript ?? '').trim(); if (!t) return
      const isNum = el instanceof HTMLInputElement && el.type === 'number', isTel = el instanceof HTMLInputElement && el.type === 'tel'
      if (isNum) { const n = spokenNumber(t); if (n) setValue(el, n) }
      else if (isTel) setValue(el, spokenDigits(t))
      else setValue(el, (el.value ? el.value + ' ' : '') + t)
    }
    r.onend = () => setOn(false); r.onerror = () => setOn(false)
    rec.current = r; setOn(true); try { r.start() } catch { setOn(false) }
  }

  if (!supported || !pos) return null
  return (
    <button type="button" onPointerDown={e => e.preventDefault()} onClick={go} title="Speak instead of typing" aria-label="Speak instead of typing"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 120 }}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm shadow print:hidden ${on ? 'animate-pulse bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>🎤</button>
  )
}
