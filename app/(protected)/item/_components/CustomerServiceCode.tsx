'use client'
import { useEffect, useState } from 'react'
import { CUSTOMER_SERVICE_CODE, CODE_VERSION } from '@/lib/customerServiceCode'

type Ack = { username: string; display_name: string; role: string; version: number | null; acknowledged_at: string | null }
type AckState = { version: number; mine: { version: number; at: string } | null; all?: Ack[] }

const fmt = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// The Customer Service Code with a "I have read and agree" button. Owner-level accounts also see who has agreed.
export default function CustomerServiceCode() {
  const [st, setSt] = useState<AckState | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set(['A']))

  type Team = { username: string; display_name: string; tag_worn: boolean | null; correct: boolean | null; correct_30d: number; days_30d: number }
  const [team, setTeam] = useState<Team[] | null>(null)
  useEffect(() => { fetch('/api/customer-service/daily').then(r => r.ok ? r.json() : null).then(d => d?.team && setTeam(d.team)).catch(() => {}) }, [])

  const load = () => fetch('/api/customer-service/ack').then(r => r.ok ? r.json() : null).then(d => d && setSt(d)).catch(() => {})
  useEffect(() => { void load() }, [])

  async function agree() {
    setBusy(true)
    await fetch('/api/customer-service/ack', { method: 'POST' }).catch(() => {})
    await load(); setBusy(false)
  }
  const agreed = st?.mine && st.mine.version >= CODE_VERSION
  const toggle = (id: string) => setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-gray-600 leading-relaxed">
        How we receive, serve and look after every customer. These rules apply to all staff, every day.
        Quote them by number, for example CS-6.
      </p>

      {CUSTOMER_SERVICE_CODE.map(sec => (
        <div key={sec.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <button type="button" onClick={() => toggle(sec.id)} className="w-full flex items-center gap-2 text-left px-3 py-2 bg-gray-50">
            <span className="text-gray-400 text-[10px]">{open.has(sec.id) ? '▴' : '▾'}</span>
            <span className="text-sm font-semibold text-gray-800">{sec.id}. {sec.title}</span>
            <span className="text-xs text-gray-400 ml-auto">{sec.rules.length}</span>
          </button>
          {open.has(sec.id) && (
            <ul className="divide-y divide-gray-100">
              {sec.rules.map(r => (
                <li key={r.code} className="flex gap-2 px-3 py-2 text-sm text-gray-800">
                  <span className="shrink-0 text-[11px] font-bold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 h-fit mt-0.5">{r.code}</span>
                  <span>{r.title && <b>{r.title} </b>}{r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {st && (agreed ? (
        <div className="rounded-lg bg-green-50 text-green-700 text-xs font-semibold px-3 py-2.5">
          ✓ You agreed to the Customer Service Code on {fmt(st.mine!.at)}.
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => void agree()}
          className="w-full rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-40 text-white font-bold py-3 text-sm transition">
          {busy ? 'Saving…' : 'I have read the Code and agree to follow it'}
        </button>
      ))}

      {team && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <p className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-50">Today&apos;s card and 30-day score</p>
          <ul className="divide-y divide-gray-100">
            {team.map(t => (
              <li key={t.username} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="font-medium text-gray-800">{t.display_name || t.username}</span>
                <span className={`ml-auto text-[11px] font-semibold ${t.tag_worn == null ? 'text-amber-600' : t.tag_worn ? 'text-green-600' : 'text-red-600'}`}>
                  {t.tag_worn == null ? 'Card not done' : t.tag_worn ? 'Tag on' : 'Tag NOT on'}
                </span>
                <span className={`text-[11px] font-semibold ${t.correct == null ? 'text-gray-300' : t.correct ? 'text-green-600' : 'text-red-600'}`}>
                  {t.correct == null ? '-' : t.correct ? 'Right' : 'Wrong'}
                </span>
                <span className="text-[11px] text-gray-500 tabular-nums w-14 text-right">{t.correct_30d}/{t.days_30d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {st?.all && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <p className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-50">Who has agreed</p>
          <ul className="divide-y divide-gray-100">
            {st.all.map(a => {
              const ok = a.version != null && Number(a.version) >= CODE_VERSION
              return (
                <li key={a.username} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="font-medium text-gray-800">{a.display_name || a.username}</span>
                  <span className="text-[10px] text-gray-400 capitalize">{a.role.replace('_', ' ')}</span>
                  <span className={`ml-auto text-xs font-semibold ${ok ? 'text-green-600' : 'text-amber-600'}`}>
                    {ok ? `✓ ${fmt(a.acknowledged_at!)}` : 'Not yet'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
