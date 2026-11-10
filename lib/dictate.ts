import { spokenDigits, spokenNumber } from '@/components/WithMic'

// Shared by the global microphone button (hub and standalone pages): which boxes can be spoken into, how a spoken sentence goes into each kind, and the listening itself.
const SKIP_TYPES = new Set(['password', 'date', 'time', 'datetime-local', 'month', 'week', 'file', 'checkbox', 'radio', 'range', 'color', 'hidden', 'submit', 'button', 'email', 'url'])
export type Field = HTMLInputElement | HTMLTextAreaElement

export function eligible(el: Element | null | undefined): el is Field {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (!(el instanceof HTMLInputElement)) return false
  return !SKIP_TYPES.has(el.type) && !el.readOnly && !el.disabled && el.getAttribute('data-nomic') == null
}

// The box must be told through the page's own onChange (React), so the value is set the way the browser does it and an input event is fired.
export function putSpoken(el: Field, transcript: string) {
  const isNum = el instanceof HTMLInputElement && el.type === 'number', isTel = el instanceof HTMLInputElement && el.type === 'tel'
  const v = isNum ? spokenNumber(transcript) : isTel ? spokenDigits(transcript) : (el.value ? el.value + ' ' : '') + transcript
  if (!v) return false
  const proto = el instanceof HTMLTextAreaElement ? el.ownerDocument.defaultView!.HTMLTextAreaElement.prototype : el.ownerDocument.defaultView!.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v)
  el.dispatchEvent(new (el.ownerDocument.defaultView!.Event)('input', { bubbles: true }))
  return true
}

type Rec = { start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null; lang: string; interimResults: boolean; continuous: boolean } // eslint-disable-line @typescript-eslint/no-explicit-any
export const canListen = () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) // eslint-disable-line @typescript-eslint/no-explicit-any
export function listenOnce(onText: (t: string) => void, onEnd: (err?: string) => void): { stop: () => void } | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!SR) return null
  const r: Rec = new SR(); r.lang = 'en-GB'; r.interimResults = false; r.continuous = false
  r.onresult = e => { const t = String(e.results?.[0]?.[0]?.transcript ?? '').trim(); if (t) onText(t) }
  r.onend = () => onEnd(); r.onerror = e => onEnd(String(e?.error ?? 'error'))
  try { r.start() } catch { onEnd('error'); return null }
  return { stop: () => { try { r.stop() } catch { /* ignore */ } } }
}
