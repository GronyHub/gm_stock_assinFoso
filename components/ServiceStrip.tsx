'use client'
import { useEffect, useState } from 'react'
import { STRIP_LINES, ruleOfDay } from '@/lib/customerServiceCode'

const STRIP_H = 24

// Slim bar that rotates one customer-service rule every 10 seconds. Shown on every page so the Code is in
// front of staff all day. On a phone the bar sits above the page and tells the Item hub how much height it
// took (--svc-strip-h); on desktop it lives inside Nav, whose height the hub already subtracts.
export default function ServiceStrip({ mobile }: { mobile?: boolean }) {
  const [i, setI] = useState(0)
  const [fade, setFade] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    // The first line shown is today's rule of the day, then the rotation continues through the short list.
    const t = setInterval(() => {
      if (document.hidden) return
      setFade(false)
      setTimeout(() => { setI(n => n + 1); setFade(true) }, 250)
    }, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!mobile) return
    document.documentElement.style.setProperty('--svc-strip-h', `${STRIP_H}px`)
    return () => { document.documentElement.style.removeProperty('--svc-strip-h') }
  }, [mobile])

  const rod = ruleOfDay(today)
  const line = i === 0
    ? { code: rod.code, text: rod.text.length > 90 ? STRIP_LINES.find(l => l.code === rod.code)?.text ?? rod.text.slice(0, 87) + '…' : rod.text, tag: 'Rule of the day' }
    : { ...STRIP_LINES[(i - 1) % STRIP_LINES.length], tag: 'Customer service' }

  return (
    <div style={{ height: STRIP_H }} className={`${mobile ? 'md:hidden' : ''} print:hidden w-full overflow-hidden bg-[#010745] text-white flex items-center justify-center gap-2 px-3`}
      role="note" aria-label="Customer service reminder">
      <span className="shrink-0 rounded bg-yellow-300 text-[#010745] text-[9px] font-extrabold px-1.5 py-0.5 leading-none uppercase tracking-wide">{line.tag}</span>
      <span className={`min-w-0 truncate text-[11px] font-semibold transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`}>
        <b className="text-yellow-300">{line.code}</b> {line.text}
      </span>
    </div>
  )
}
