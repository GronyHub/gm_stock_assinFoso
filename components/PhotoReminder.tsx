'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import StaffAvatar from '@/components/StaffAvatar'

// Pop-up shown every time a page is loaded (refreshed) until the signed-in person has added their display
// photo. "Later" only hides it until the next refresh. "Add my photo now" opens the Profile tab of the person's own page in the hub; it
// disappears the moment a photo is saved (ProfileTab announces that with 'gm-photo-changed').
export default function PhotoReminder() {
  const path = usePathname()
  const [need, setNeed] = useState<{ name: string; username: string } | null>(null)
  const [later, setLater] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/profile').then(r => r.ok ? r.json() : null).then(d => {
      if (live && d && !d.photo_url) setNeed({ name: d.display_name || d.username || '', username: d.username || '' })
    }).catch(() => {})
    const on = (e: Event) => { if ((e as CustomEvent).detail) setNeed(null) }
    window.addEventListener('gm-photo-changed', on)
    return () => { live = false; window.removeEventListener('gm-photo-changed', on) }
  }, [])

  if (!need || later || path === '/profile') return null
  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center">
        <div className="flex justify-center mb-3"><StaffAvatar name={need.name} size={72} className="!border-gray-200" /></div>
        <p className="text-lg font-bold text-gray-900">Add your display photo{need.name ? `, ${need.name}` : ''}</p>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Your photo shows beside your name across the app and goes on your employee tag, so customers and colleagues
          know who you are. Use a clear, front-facing photo of your face. It takes less than a minute.
        </p>
        <button type="button" onClick={() => { setLater(true); const d = { name: need.username, tab: 'profile', handled: false }; if (need.username) window.dispatchEvent(new CustomEvent('open-staff-member', { detail: d })); if (!d.handled) window.location.href = '/item?me=profile' }}
          className="mt-4 block w-full rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold py-3 text-base transition">
          Add my photo now
        </button>
        <button type="button" onClick={() => setLater(true)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 py-1">
          Remind me later
        </button>
      </div>
    </div>
  )
}
