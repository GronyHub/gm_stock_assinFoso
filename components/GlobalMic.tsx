'use client'
import { useEffect, useRef, useState } from 'react'
import { eligible, putSpoken, canListen, listenOnce, type Field } from '@/lib/dictate'
import { parseVerb, matchDest, fillSearchBox, type Dest } from '@/lib/voiceCommands'

// The one microphone, always in the same place (bottom right). Press it and speak: no box needs to be tapped first.
//  - If a text box is being typed in, the words go into it (unless you start with "open" or "search").
//  - Otherwise the sentence is a command, tried in this order: the page you are on (via the `page-voice` message: Company Laws matches tile names, then law names),
//    a destination ("open customers", "go to the daily checklist"), a Live Sale ("ghana card, 2 pieces, 40 cedis, man in red"), then the page's search box.
// `frame` is the page shown in the hub's right pane, when there is one. `dests` are where "open ..." can go. `onVoiceSale` is given only on Live Sale.
export default function GlobalMic({ frame, dests = [], onVoiceSale, className = '' }: { frame?: React.RefObject<HTMLIFrameElement | null>; dests?: Dest[]; onVoiceSale?: (text: string) => void; className?: string }) {
  const [on, setOn] = useState(false)
  const [hint, setHint] = useState('')
  const rec = useRef<{ stop: () => void } | null>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => { setOk(canListen()); return () => { try { rec.current?.stop() } catch { /* ignore */ } } }, [])
  const say = (m: string, ms = 4000) => { setHint(m); setTimeout(() => setHint(h => (h === m ? '' : h)), ms) }

  // The page in the right pane may answer a spoken sentence itself (message back within a moment).
  function askPage(text: string): Promise<string | null> {
    const win = frame?.current?.contentWindow
    if (!win) return Promise.resolve(null)
    return new Promise(resolve => {
      const done = (v: string | null) => { window.removeEventListener('message', h); clearTimeout(t); resolve(v) }
      const h = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === 'page-voice-result') done(e.data.handled ? String(e.data.message ?? 'Done') : null) }
      const t = setTimeout(() => done(null), 900)
      window.addEventListener('message', h)
      win.postMessage({ type: 'page-voice', text }, window.location.origin)
    })
  }

  function focusedField(): Field | null {
    try { const d = frame?.current?.contentDocument; if (d) { const a = d.activeElement; if (eligible(a)) return a } } catch { /* different origin */ }
    const a = document.activeElement
    return eligible(a) ? a : null
  }

  async function handle(text: string) {
    const v = parseVerb(text)
    const box = focusedField()
    if (box && !v.verb) { if (!putSpoken(box, text)) say('I did not catch a number. Try again.'); return }
    // 1. the page you are on (unless you clearly asked for another page: "open customers page")
    if (!(v.verb === 'open' && v.explicitPage)) { const r = await askPage(v.verb === 'search' ? v.rest : text); if (r) { say(r); return } }
    // 2. a destination
    if (v.verb !== 'search') { const d = matchDest(v.rest, dests); if (d && (v.verb === 'open' || v.explicitPage || v.rest.split(' ').length <= 4)) { d.run(); say(`Opened ${d.label}`); return } }
    // 3. Live Sale
    if (onVoiceSale && v.verb !== 'search' && v.verb !== 'open') { onVoiceSale(text); return }
    // 4. the page's search box (in the right pane if one is open, else this page)
    const q = v.verb === 'search' ? v.rest : v.verb === 'open' ? '' : text
    if (q) { let doc: Document | null = null; try { doc = frame?.current?.contentDocument ?? null } catch { /* ignore */ } if (fillSearchBox(doc ?? document, q)) { say(`Searching for "${q}"`); return } }
    say(`I heard "${text}" but did not understand. Try "open customers", "search ghana card", or say a sale.`, 6000)
  }

  function tap() {
    if (on) { rec.current?.stop(); return }
    rec.current = listenOnce(txt => { void handle(txt) }, err => { setOn(false); if (err === 'not-allowed') say('Allow the microphone for this site, then try again.'); else if (err && err !== 'aborted' && err !== 'no-speech') say('I did not hear you. Tap the microphone and try again.') ; else if (err === 'no-speech') say('I did not hear anything. Tap the microphone and speak.') })
    setOn(!!rec.current)
  }

  if (!ok) return null
  return (<>
    {hint && <div className="fixed bottom-20 right-4 z-40 max-w-[240px] rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-lg print:hidden">{hint}</div>}
    <button type="button" onPointerDown={e => e.preventDefault()} onClick={tap} title="Speak: say where to go, what to search, or a sale" aria-label="Speak"
      className={`fixed z-40 flex h-11 w-11 items-center justify-center rounded-full text-lg text-white shadow-lg print:hidden ${on ? 'animate-pulse bg-red-600' : 'bg-red-600 hover:bg-red-700'} ${className}`}>🎤</button>
  </>)
}
