'use client'
import { useEffect, useRef, useState } from 'react'
import { eligible, putSpoken, canListen, listenOnce, type Field } from '@/lib/dictate'

// The one microphone, always in the same place (bottom right). What it does depends on the page you are on:
//  - a box was being typed in (on this page, or on the page shown in the right pane): the words go into that box;
//  - on Live Sale with no box in use: it opens the voice sale card (say what you sold);
//  - otherwise it reminds you to tap a box first.
// `frame` is the page shown in the hub's right pane, when there is one. `onVoiceSale` is given only where the page can record a sale by voice.
export default function GlobalMic({ frame, onVoiceSale, className = '' }: { frame?: React.RefObject<HTMLIFrameElement | null>; onVoiceSale?: () => void; className?: string }) {
  const [on, setOn] = useState(false)
  const [hint, setHint] = useState('')
  const last = useRef<Field | null>(null)
  const rec = useRef<{ stop: () => void } | null>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => { setOk(canListen()) }, [])
  useEffect(() => {
    const f = (e: FocusEvent) => { if (eligible(e.target as Element)) last.current = e.target as Field }
    window.addEventListener('focusin', f)
    return () => { window.removeEventListener('focusin', f); try { rec.current?.stop() } catch { /* ignore */ } }
  }, [])
  const say = (m: string) => { setHint(m); setTimeout(() => setHint(''), 3500) }

  function target(): Field | null {
    // The page in the right pane keeps its own "last box"; ask it first.
    try { const d = frame?.current?.contentDocument; if (d) { const a = d.activeElement; if (eligible(a)) return a } } catch { /* different origin */ }
    if (frame?.current) return null
    return last.current && last.current.isConnected ? last.current : null
  }

  function tap() {
    if (on) { rec.current?.stop(); return }
    const t = target()
    if (!t && onVoiceSale && !frame?.current) { onVoiceSale(); return }
    if (!t) { say('Tap a box first, then the microphone, then speak.'); return }
    rec.current = listenOnce(txt => { if (!putSpoken(t, txt)) say('I did not catch a number. Try again.') }, err => { setOn(false); if (err === 'not-allowed') say('Allow the microphone for this site, then try again.') })
    setOn(!!rec.current)
  }

  if (!ok) return null
  return (<>
    {hint && <div className="fixed bottom-20 right-4 z-40 max-w-[220px] rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-lg print:hidden">{hint}</div>}
    <button type="button" onPointerDown={e => e.preventDefault()} onClick={tap} title="Speak (into the box you are typing in, or say a sale on Live Sale)" aria-label="Speak"
      className={`fixed z-40 flex h-11 w-11 items-center justify-center rounded-full text-lg text-white shadow-lg print:hidden ${on ? 'animate-pulse bg-red-600' : 'bg-red-600 hover:bg-red-700'} ${className}`}>🎤</button>
  </>)
}
