'use client'
import { useCallback, useEffect, useState } from 'react'

type Device = { device_id: string; username: string; status: string; platform: string | null; last_seen: string; status_since: string; last_ok: string | null; subscribed: boolean }

const LABEL: Record<string, string> = { on: 'On', off: 'Not turned on', blocked: 'Blocked', unsupported: 'Not supported', 'needs-install': 'Not installed to home screen', expired: 'Stopped working' }

function ago(iso: string | null) {
  if (!iso) return 'never'
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 2) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 60 * 36) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}

export default function NotificationsClient() {
  const [rows, setRows] = useState<Device[] | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const load = useCallback(() => {
    fetch('/api/push/health').then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]))
  }, [])
  useEffect(() => { load() }, [load])

  async function test(id: string) {
    setBusy(id); setMsg(m => ({ ...m, [id]: '' }))
    const r = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: id }) })
    const d = await r.json().catch(() => ({}))
    setMsg(m => ({ ...m, [id]: r.ok ? 'Test sent. Did that phone buzz?' : (d.error ?? 'Could not send') }))
    setBusy(''); load()
  }

  const bad = (rows ?? []).filter(r => r.status !== 'on').length
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3">
      <div className="flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500 hover:text-gray-900">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Notifications</h1>
        <button onClick={load} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">Refresh</button>
      </div>

      <div className={`rounded-xl border p-3 text-sm font-semibold ${bad ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
        {rows === null ? 'Loading…' : bad ? `${bad} phone${bad === 1 ? '' : 's'} need attention.` : rows.length ? 'Every phone that opened the app recently has notifications on.' : 'No phone has reported in yet. They appear after the app is opened on them.'}
      </div>

      <div className="space-y-2">
        {(rows ?? []).map(r => (
          <div key={r.device_id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-gray-900">{r.username}</p>
              <span className="text-xs text-gray-500">{r.platform ?? 'Unknown device'}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${r.status === 'on' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{LABEL[r.status] ?? r.status}</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Last opened the app: {ago(r.last_seen)} · Last notification delivered: {ago(r.last_ok)}
              {r.status !== 'on' && ` · ${LABEL[r.status] ?? r.status} since ${ago(r.status_since)}`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button disabled={busy === r.device_id || !r.subscribed} onClick={() => void test(r.device_id)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">{busy === r.device_id ? 'Sending…' : 'Send test'}</button>
              {!r.subscribed && <span className="text-xs text-gray-500">No notification link. This phone has to open the app and turn notifications on.</span>}
              {msg[r.device_id] && <span className="text-xs font-semibold text-gray-700">{msg[r.device_id]}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800">
        <p className="mb-1 font-bold text-[#14213D]">Phone settings that keep notifications on</p>
        <p className="mt-2 font-semibold">Android</p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          <li>Install Grony to the home screen (Chrome menu, Install app).</li>
          <li>Phone Settings, Apps, Grony (or Chrome), Notifications: On.</li>
          <li>Phone Settings, Apps, Grony, Battery: set to &quot;Unrestricted&quot;.</li>
          <li>Turn off &quot;Pause app activity if unused&quot; (and &quot;Remove permissions&quot;) for the app and for Chrome.</li>
          <li>Do not clear Chrome&apos;s site data or cookies; that removes the permission.</li>
        </ul>
        <p className="mt-2 font-semibold">iPhone</p>
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          <li>Open Grony in Safari, tap Share, Add to Home Screen. Notifications only work from the home screen icon, not from the Safari tab.</li>
          <li>Open from the icon and tap &quot;Turn on notifications&quot;, then Allow.</li>
          <li>Settings, Notifications, Grony: Allow Notifications on. Make sure no Focus mode is silencing it.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500">Each phone renews its notification link by itself every time the app is opened. A phone that is not opened for 3 days, or whose notifications stay off for a day, is reported to you by email.</p>
      </div>
    </div>
  )
}
