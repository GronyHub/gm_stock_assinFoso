'use client'
import { useCallback, useEffect, useState } from 'react'
import { StaffMemberPersonalTab, STAFF_ROSTER } from './hubShared'
import type { HubCtx } from './useHubState'

const UNLOCK_KEY = 'gmPinUntil'
const UNLOCK_MS = 10 * 60 * 1000

type Status = { hasPin: boolean; lockedMinutes: number }

// A four-digit keypad: shows dots, sends the PIN when the fourth digit is tapped.
function PinPad({ title, hint, error, busy, onDone }: { title: string; hint?: string; error?: string; busy?: boolean; onDone: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  useEffect(() => { if (error) setPin('') }, [error])
  const press = (d: string) => {
    if (busy) return
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length === 4) { onDone(next); setTimeout(() => setPin(''), 150) }
  }
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-3 px-4 py-6">
      <p className="text-[16px] text-gray-900">{title}</p>
      {hint && <p className="text-center text-[13px] text-gray-500">{hint}</p>}
      <div className="flex gap-3" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map(i => <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 ${i < pin.length ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`} />)}
      </div>
      <p role="alert" className="min-h-[20px] text-center text-[13px] text-red-600">{error ?? ''}</p>
      <div className="grid w-full grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => d === '' ? <span key={i} /> : (
          <button key={d} type="button" disabled={busy} onClick={() => (d === '⌫' ? setPin(p => p.slice(0, -1)) : press(d))} aria-label={d === '⌫' ? 'Delete' : d}
            className="min-h-[52px] rounded-xl border border-gray-200 bg-white text-[20px] text-gray-900 active:bg-gray-100 disabled:opacity-40">{d}</button>
        ))}
      </div>
    </div>
  )
}

// My picture opens this window: Payslips, Profile and Settings. Once I have set a PIN it asks for it first (and again after 10 minutes).
export default function HubProfileWindow({ h, onClose }: { h: HubCtx; onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [unlockedUntil, setUnlockedUntil] = useState(0)
  const [tab, setTab] = useState<'payslips' | 'profile' | 'settings'>('payslips')
  const [mode, setMode] = useState<'view' | 'set' | 'change'>('view')
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('new')
  const [draft, setDraft] = useState({ current: '', first: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const username = h.username

  useEffect(() => {
    try { setUnlockedUntil(Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0)) } catch { /* ignore */ }
    fetch('/api/profile-pin', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setStatus(d ?? { hasPin: false, lockedMinutes: 0 })).catch(() => setStatus({ hasPin: false, lockedMinutes: 0 }))
  }, [])

  const unlock = useCallback(() => {
    const until = Date.now() + UNLOCK_MS
    setUnlockedUntil(until)
    try { sessionStorage.setItem(UNLOCK_KEY, String(until)) } catch { /* ignore */ }
  }, [])

  const call = async (body: Record<string, unknown>) => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/profile-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error ?? 'Could not save'); return null }
      if (d.ok === false) {
        setErr(d.locked ? `Too many tries. Try again in ${d.minutes} minutes, or ask Joe or Grony to reset it.` : `Wrong PIN. ${d.left} ${d.left === 1 ? 'try' : 'tries'} left.`)
        if (d.locked) setStatus(s => (s ? { ...s, lockedMinutes: d.minutes } : s))
        return null
      }
      return d
    } catch { setErr('No connection. Try again.'); return null } finally { setBusy(false) }
  }

  const hasPin = !!status?.hasPin
  const unlocked = !hasPin || unlockedUntil > Date.now()
  const startSet = () => { setMode(hasPin ? 'change' : 'set'); setStep(hasPin ? 'current' : 'new'); setDraft({ current: '', first: '' }); setErr('') }

  let body: React.ReactNode
  if (!status) body = <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
  else if (mode !== 'view') {
    body = step === 'current'
      ? <PinPad key="c" title="Enter your current PIN" error={err} busy={busy} onDone={pin => { setDraft(d => ({ ...d, current: pin })); setErr(''); setStep('new') }} />
      : step === 'new'
        ? <PinPad key="n" title={hasPin ? 'Choose a new 4-digit PIN' : 'Choose a 4-digit PIN'} hint="It protects your payslips, profile and settings on this phone. Do not tell anyone." error={err} busy={busy} onDone={pin => { setDraft(d => ({ ...d, first: pin })); setErr(''); setStep('confirm') }} />
        : <PinPad key="f" title="Enter it again" error={err} busy={busy} onDone={async pin => {
            if (pin !== draft.first) { setErr('The two PINs are not the same. Start again.'); setStep('new'); return }
            const d = await call({ action: mode === 'change' ? 'change' : 'set', pin, currentPin: draft.current || undefined })
            if (d) { setStatus({ hasPin: true, lockedMinutes: 0 }); unlock(); setMode('view') } else if (hasPin) setStep('current')
          }} />
  } else if (!unlocked) {
    body = status.lockedMinutes > 0
      ? <p className="px-6 py-10 text-center text-[14px] text-red-600">Too many tries. Try again in {status.lockedMinutes} minutes, or ask Joe or Grony to reset your PIN.</p>
      : <PinPad title="Enter your PIN" hint="Forgotten it? Ask Joe or Grony to reset it." error={err} busy={busy} onDone={async pin => { const d = await call({ action: 'verify', pin }); if (d) unlock() }} />
  } else {
    body = (
      <>
        {tab === 'settings' ? (
          <div className="space-y-2 p-3">
            {h.canOpenSettings && <button type="button" onClick={() => { onClose(); h.setShop(null); h.pickLossView('settings') }} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-[15px] text-gray-900"><span aria-hidden="true">⚙️</span>Open Settings<span aria-hidden="true" className="ml-auto text-gray-300">›</span></button>}
            {h.canOpenUkSettings && <button type="button" onClick={() => { onClose(); h.setShop(null); h.changeTab('uk'); setTimeout(() => h.setSettingsOpen(true), 50) }} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-[15px] text-gray-900"><span aria-hidden="true">🇬🇧</span>UK Settings<span aria-hidden="true" className="ml-auto text-gray-300">›</span></button>}
            {!h.canOpenSettings && !h.canOpenUkSettings && <p className="py-6 text-center text-sm text-gray-500">You have no settings to change.</p>}
          </div>
        ) : (
          <StaffMemberPersonalTab key={tab} hideTabs staffName={username} initialTab={tab as never} username={username} role={h.role} canManage={h.canManage} staffRoster={STAFF_ROSTER} routablePages={h.routablePages} categoryIds={h.fixedCategoryIds} />
        )}
        <div className="px-3 pb-4 pt-2">
          <button type="button" onClick={startSet} className="text-[13px] font-semibold text-blue-700">{hasPin ? '🔒 Change my PIN' : '🔒 Set a 4-digit PIN to protect this'}</button>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label="My account" className="mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2">
          <div role="tablist" className="flex flex-1 gap-1.5">
            {mode === 'view' && unlocked && status && ([['payslips', '💵 Payslips'], ['profile', '👤 Profile'], ['settings', '⚙️ Settings']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-[14px] font-semibold ${tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>
            ))}
            {!(mode === 'view' && unlocked) && <p className="py-1.5 text-[14px] text-gray-700">🔒 My account</p>}
          </div>
          <button type="button" onClick={mode === 'view' ? onClose : () => { setMode('view'); setErr('') }} aria-label={mode === 'view' ? 'Close' : 'Cancel'} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">{body}</div>
      </div>
    </div>
  )
}
