'use client'
import { useState } from 'react'
import { FEATURES } from '@/lib/features'
import { useFeatures, setFeature } from '@/lib/useFeatures'

export type SettingsLink = { icon: string; label: string; detail?: string; onClick: () => void }

// SETTINGS (left sidebar, owner and manager): the on/off switches for features, then the private pages (team payslips and profiles,
// users and roles, view as, lists, activity times, push devices, barcode labels, whose page you are viewing).
export default function SettingsHome({ canEdit, pages, viewing }: { canEdit: boolean; pages: SettingsLink[]; viewing?: { names: string[]; current: string; pick: (n: string) => void } }) {
  const f = useFeatures()
  const [msg, setMsg] = useState('')
  const groups = [...new Set(FEATURES.map(x => x.group))]
  async function flip(key: (typeof FEATURES)[number]['key']) {
    setMsg('')
    const ok = await setFeature(key, !f[key])
    setMsg(ok ? `${FEATURES.find(x => x.key === key)!.label}: ${!f[key] ? 'on' : 'off'}. It applies on every device within a minute.` : 'Only Grony or Joe can change a switch.')
  }
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-3 py-4">
      <h1 className="text-lg font-extrabold text-[#14213D]">⚙️ Settings</h1>

      <section className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Switches</p>
        {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
        {groups.map(g => (
          <div key={g} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <p className="bg-gray-50 px-3 py-1.5 text-[12px] font-extrabold uppercase text-gray-600">{g}</p>
            {FEATURES.filter(x => x.group === g).map(x => (
              <div key={x.key} className="flex items-start gap-3 border-t border-gray-100 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{x.label}</p>
                  <p className="text-[12px] leading-snug text-gray-600">{x.detail}</p>
                </div>
                <button type="button" role="switch" aria-checked={f[x.key]} disabled={!canEdit} onClick={() => void flip(x.key)} title={canEdit ? '' : 'Only Grony or Joe can change this'}
                  className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${f[x.key] ? 'bg-green-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${f[x.key] ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      {pages.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Private pages</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {pages.map(p => (
              <button key={p.label} type="button" onClick={p.onClick} className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:bg-gray-50">
                <span className="text-lg leading-none">{p.icon}</span>
                <span className="min-w-0"><span className="block text-sm font-bold text-gray-900">{p.label}</span>{p.detail && <span className="block text-[12px] text-gray-500">{p.detail}</span>}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {viewing && viewing.names.length > 1 && (
        <section className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Viewing (whose personal pages open)</p>
          <div className="flex flex-wrap gap-1.5">
            {viewing.names.map(n => (
              <button key={n} type="button" onClick={() => viewing.pick(n)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${viewing.current.toLowerCase() === n.toLowerCase() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{n}</button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
