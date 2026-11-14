'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import StaffAvatar, { announcePhotoChange } from '@/components/StaffAvatar'
import RatingsCard from '@/components/RatingsCard'

type Profile = {
  id: number; username: string; display_name: string; email: string | null; phone: string | null; role: string; photo_url?: string | null
}

// Shrinks a photo in the browser before upload (phones send 5-10 MB photos): longest side 800 px, JPEG.
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file)
    const sc = Math.min(1, 800 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}
type StaffProfile = {
  staff_name: string; full_name: string | null; start_date: string | null; date_of_birth: string | null
  ghana_card: string | null; ssnit_number: string | null; phone: string | null; address: string | null
  bank_name: string | null; bank_account: string | null; momo_number: string | null
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-500 font-medium mb-1 block'

const STAFF_PROFILE_FIELDS: { key: keyof StaffProfile; label: string; type?: string; readonly?: boolean; span?: boolean }[] = [
  { key: 'full_name',     label: 'Full Legal Name' },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
  { key: 'ghana_card',    label: 'Ghana Card No.' },
  { key: 'ssnit_number',  label: 'SSNIT Number' },
  { key: 'phone',         label: 'Phone Number', type: 'tel' },
  { key: 'momo_number',   label: 'MoMo Number', type: 'tel' },
  { key: 'bank_name',     label: 'Bank Name' },
  { key: 'bank_account',  label: 'Bank Account No.' },
  { key: 'address',       label: 'Home Address', span: true },
  { key: 'start_date',    label: 'Start Date', type: 'date', readonly: true },
]

// Always self-scoped -- reads the logged-in session's own username, not a
// viewingStaff/staffName param, since it edits login credentials (password,
// email) alongside HR details. See StaffPersonTab: this only ever shows on
// your own Personal tab, never under "Others", for exactly that reason.
export default function ProfileTab() {
  const { data: session } = useSession()
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''

  const [profile, setProfile] = useState<Profile | null>(null)
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ display_name: '', email: '', phone: '', password: '', confirm: '' })
  const [staffForm, setStaffForm] = useState<Partial<StaffProfile>>({})
  const [saving, setSaving] = useState(false)
  const [savingStaff, setSavingStaff] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [staffSuccess, setStaffSuccess] = useState('')
  const [staffError, setStaffError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/staff/profiles').then(r => r.json()).catch(() => []),
    ]).then(([data, profiles]) => {
      setProfile(data)
      setForm({ display_name: data.display_name ?? '', email: data.email ?? '', phone: data.phone ?? '', password: '', confirm: '' })
      const rows: StaffProfile[] = Array.isArray(profiles) ? profiles : []
      const myRow = rows.find(p => p.staff_name?.toLowerCase() === username?.toLowerCase()) ?? null
      setStaffProfile(myRow)
      if (myRow) setStaffForm({ ...myRow })
      setLoading(false)
    })
  }, [username])

  const photoInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [photoMenu, setPhotoMenu] = useState(false)

  // In-app camera: the live picture is shown right here and a small square photo is taken from it. Unlike
  // handing over to the phone's camera app, the browser never leaves the screen, so a low-memory phone does
  // not clear the page out of memory (that showed "Unable to complete previous operation due to low memory"
  // and lost the photo). Falls back to the phone's camera app if the camera cannot be opened here.
  const [camOpen, setCamOpen] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [camFacing, setCamFacing] = useState<'user' | 'environment'>('user')
  const videoEl = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopCam() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }
  useEffect(() => {
    if (!camOpen) return
    let live = true
    setCamErr('')
    stopCam()
    if (!navigator.mediaDevices?.getUserMedia) { setCamOpen(false); cameraInput.current?.click(); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing, width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then(s => {
        if (!live) { s.getTracks().forEach(t => t.stop()); return }
        streamRef.current = s
        if (videoEl.current) { videoEl.current.srcObject = s; void videoEl.current.play().catch(() => {}) }
      })
      .catch(() => { if (live) { setCamOpen(false); setPhotoErr('Could not open the camera here. Opening your phone camera instead…'); cameraInput.current?.click() } })
    return () => { live = false; stopCam() }
  }, [camOpen, camFacing])

  function snap() {
    const v = videoEl.current
    if (!v || !v.videoWidth) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    const c = document.createElement('canvas'); c.width = c.height = Math.min(640, side)
    const ctx = c.getContext('2d')!
    // front camera is mirrored on screen, so the saved photo is not flipped back
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, c.width, c.height)
    c.toBlob(b => {
      if (!b) { setCamErr('Could not take the photo. Try again.'); return }
      setCamOpen(false)
      void uploadPhoto(new File([b], 'photo.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.85)
  }
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState('')

  async function uploadPhoto(f: File) {
    setPhotoBusy(true); setPhotoErr('')
    try {
      const fd = new FormData(); fd.append('file', await shrinkPhoto(f))
      const r = await fetch('/api/profile/photo', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save the photo')
      setProfile(p => p ? { ...p, photo_url: d.photo_url } : p)
      announcePhotoChange(d.photo_url)
    } catch (e) { setPhotoErr((e as Error).message) }
    setPhotoBusy(false)
  }

  async function removePhoto() {
    if (!confirm('Remove your display photo?')) return
    setPhotoBusy(true); setPhotoErr('')
    await fetch('/api/profile/photo', { method: 'DELETE' }).catch(() => {})
    setProfile(p => p ? { ...p, photo_url: null } : p)
    announcePhotoChange(null)
    setPhotoBusy(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (form.password && form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password && form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setProfile(updated)
      setForm(f => ({ ...f, password: '', confirm: '' }))
      setSuccess('Profile updated.')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Could not save')
    }
  }

  async function handleSaveStaff(e: React.FormEvent) {
    e.preventDefault()
    if (!staffProfile) return
    setSavingStaff(true); setStaffError(''); setStaffSuccess('')
    const res = await fetch('/api/staff/profiles', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: staffProfile.staff_name, ...staffForm }),
    })
    setSavingStaff(false)
    if (res.ok) {
      const updated = await res.json()
      setStaffProfile(updated)
      setStaffForm({ ...updated })
      setStaffSuccess('Details saved.')
    } else {
      const d = await res.json().catch(() => ({}))
      setStaffError(d.error ?? 'Could not save')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="max-w-md mx-auto space-y-4">
      <RatingsCard />
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <StaffAvatar name={profile?.display_name || profile?.username || ''} url={profile?.photo_url} size={88} className="!border-gray-200" />
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{profile?.display_name || profile?.username}</p>
            <p className="text-xs text-gray-400">@{profile?.username} · <span className="capitalize">{profile?.role}</span></p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button type="button" disabled={photoBusy} onClick={() => setPhotoMenu(v => !v)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                {photoBusy ? 'Saving…' : profile?.photo_url ? 'Change photo' : 'Add photo'}
              </button>
              {profile?.photo_url && (
                <button type="button" disabled={photoBusy} onClick={() => void removePhoto()}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-40">Remove</button>
              )}
            </div>
            <input ref={photoInput} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = '' }} />
            {/* capture="user" opens the phone's front camera straight away */}
            <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = '' }} />
          </div>
        </div>
        {camOpen && (
          <div className="fixed inset-0 z-[400] bg-black flex flex-col items-center justify-center p-4 gap-3">
            <video ref={videoEl} playsInline muted autoPlay
              className={`w-full max-w-sm aspect-square object-cover rounded-2xl bg-gray-900 ${camFacing === 'user' ? '-scale-x-100' : ''}`} />
            {camErr && <p className="text-sm text-red-300">{camErr}</p>}
            <p className="text-xs text-gray-300">Face the camera in good light, then tap Take photo.</p>
            <div className="flex items-center gap-3 w-full max-w-sm">
              <button type="button" onClick={() => setCamOpen(false)}
                className="px-4 py-3 rounded-xl bg-gray-700 text-white text-sm font-semibold">Cancel</button>
              <button type="button" onClick={snap}
                className="flex-1 py-3 rounded-xl bg-green-600 active:bg-green-700 text-white text-base font-bold">Take photo</button>
              <button type="button" onClick={() => setCamFacing(f => f === 'user' ? 'environment' : 'user')}
                className="px-4 py-3 rounded-xl bg-gray-700 text-white text-sm font-semibold" title="Switch camera">🔄</button>
            </div>
          </div>
        )}
        {photoMenu && !photoBusy && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setPhotoMenu(false); setCamFacing('user'); setCamOpen(true) }}
              className="rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-semibold text-blue-700">📷 Take photo</button>
            <button type="button" onClick={() => { setPhotoMenu(false); photoInput.current?.click() }}
              className="rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm font-semibold text-gray-700">🖼 Choose from gallery</button>
          </div>
        )}
        {photoErr && <p className="text-xs text-red-600 mt-2">{photoErr}</p>}
        <p className="text-[12px] text-gray-400 mt-3">
          Your display photo shows beside your name across the app and is printed on your employee tag. Use a clear,
          front-facing photo of your face, taken in good light. You can change it any time.
        </p>
      </div>

      {/* ── Login details ─────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Login Details</p>
        <div>
          <label className={labelCls}>Display Name</label>
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="Your name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email Address</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com" className={inputCls} />
          <p className="text-[12px] text-gray-400 mt-1">Used for login and password reset</p>
        </div>
        <div>
          <label className={labelCls}>Phone Number</label>
          <input type="tel" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="e.g. 0244123456" className={inputCls} />
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Change Password</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>New Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to keep current" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Confirm Password</label>
              <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password" className={inputCls} />
            </div>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}
        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* ── Staff personal details ─────────────────────────────────── */}
      {staffProfile && (
        <form onSubmit={handleSaveStaff} className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-700">Staff Details</p>
            <p className="text-[12px] text-gray-400 mt-0.5">
              This information is used for payslips and HR records. Please fill in all fields accurately.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {STAFF_PROFILE_FIELDS.map(({ key, label, type, readonly, span }) => (
              <div key={key} className={span ? 'col-span-2' : ''}>
                <label className={labelCls}>{label}</label>
                <input
                  type={type ?? 'text'}
                  readOnly={readonly}
                  value={(staffForm as any)[key] ?? ''}
                  onChange={e => !readonly && setStaffForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={readonly ? 'Set by admin' : label}
                  className={`${inputCls} ${readonly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            ))}
          </div>

          {/* Completion status */}
          {(() => {
            const required = ['full_name', 'date_of_birth', 'ghana_card', 'ssnit_number', 'phone', 'momo_number', 'bank_name', 'bank_account', 'address'] as const
            const filled = required.filter(k => staffForm[k])
            const missing = required.filter(k => !staffForm[k])
            return (
              <div className={`rounded-xl px-3 py-2.5 text-xs ${filled.length === required.length ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {filled.length === required.length
                  ? '✓ All details complete'
                  : `${missing.length} field${missing.length !== 1 ? 's' : ''} still missing: ${missing.map(k => STAFF_PROFILE_FIELDS.find(f => f.key === k)?.label ?? k).join(', ')}`}
              </div>
            )
          })()}

          {staffError && <p className="text-red-500 text-sm">{staffError}</p>}
          {staffSuccess && <p className="text-green-600 text-sm">{staffSuccess}</p>}
          <button type="submit" disabled={savingStaff}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition">
            {savingStaff ? 'Saving...' : 'Save Staff Details'}
          </button>
        </form>
      )}
    </div>
  )
}
