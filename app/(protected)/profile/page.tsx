'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type Profile = {
  id: number; username: string; display_name: string; email: string | null; phone: string | null; role: string
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

export default function ProfilePage() {
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
    <div className="py-4 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">My Profile</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-1">Username</p>
        <p className="font-semibold text-gray-800">@{profile?.username}</p>
        <p className="text-xs text-gray-400 mt-2 mb-1">Role</p>
        <p className="text-sm capitalize text-gray-700">{profile?.role}</p>
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
          <p className="text-[10px] text-gray-400 mt-1">Used for login and password reset</p>
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
            <p className="text-[11px] text-gray-400 mt-0.5">
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
