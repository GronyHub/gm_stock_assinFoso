'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'

export type User = {
  id: number
  username: string
  display_name: string
  email: string | null
  role: string
  created_at: string
  active: boolean
  resigned_at: string | null
  deactivation_reason: string | null
}

export type Role = { key: string; label: string; created_at: string }

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-500 font-medium mb-1 block'

const EMPTY_NEW = { username: '', display_name: '', email: '', role: 'staff', password: '', confirm: '' }

const DEACTIVATION_REASONS = ['Resigned', 'Terminated', 'Suspended', 'Absconded', 'End of Contract', 'Other'] as const

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Plain password inputs give no way to catch a typo before saving -- this
// adds a per-field reveal toggle so what you typed can be checked (and
// written down somewhere) before it's hashed and unrecoverable.
function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={inputCls + ' pr-10'} />
      <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

// The account-management half of what used to be the standalone /users page
// -- pulled out into its own prop-driven component so the merged Access
// screen (AccessPage.tsx) can share one users+roles fetch with the Roles
// panel instead of each page fetching its own copy. Still used as-is by
// app/(protected)/users/page.tsx for direct /users access.
export default function UsersPanel({ users, setUsers, roles }: {
  users: User[]
  setUsers: React.Dispatch<React.SetStateAction<User[]>>
  roles: Role[]
}) {
  const { data: session } = useSession()
  const myRole = (session?.user as any)?.role
  const myId = String((session?.user as any)?.id ?? '')
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', email: '', role: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)
  const [resignDate, setResignDate] = useState(todayStr())
  const [reasonChoice, setReasonChoice] = useState<string>(DEACTIVATION_REASONS[0])
  const [reasonOther, setReasonOther] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState('')

  function startEdit(u: User) {
    setEditId(u.id)
    setEditForm({ display_name: u.display_name, email: u.email ?? '', role: u.role, password: '', confirm: '' })
    setEditError('')
  }

  async function saveEdit(u: User) {
    if (editForm.password && editForm.password !== editForm.confirm) {
      setEditError('Passwords do not match'); return
    }
    if (editForm.password && editForm.password.length < 6) {
      setEditError('Password must be at least 6 characters'); return
    }
    setSaving(true)
    setEditError('')
    const body: Record<string, unknown> = {
      display_name: editForm.display_name,
      email: editForm.email || null,
      role: editForm.role,
    }
    if (editForm.password) body.password = editForm.password
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x))
      setEditId(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setEditError(d.error ?? 'Save failed')
    }
  }

  async function saveNew() {
    if (!newForm.username.trim() || !newForm.password) { setAddError('Username and password are required'); return }
    if (newForm.password !== newForm.confirm) { setAddError('Passwords do not match'); return }
    if (newForm.password.length < 6) { setAddError('Password must be at least 6 characters'); return }
    setAdding(true)
    setAddError('')
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newForm.username.trim().toLowerCase(),
        display_name: newForm.display_name || newForm.username,
        email: newForm.email || null,
        role: newForm.role,
        password: newForm.password,
      }),
    })
    setAdding(false)
    if (res.ok) {
      const created = await res.json()
      setUsers(prev => [...prev, { ...created, active: true, resigned_at: null, deactivation_reason: null }])
      setNewForm({ ...EMPTY_NEW })
      setShowAdd(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setAddError(d.error ?? 'Could not create user')
    }
  }

  function startDeactivate(u: User) {
    setDeactivatingId(u.id)
    setResignDate(todayStr())
    setReasonChoice(DEACTIVATION_REASONS[0])
    setReasonOther('')
    setStatusError('')
  }

  async function confirmDeactivate(u: User) {
    const reason = reasonChoice === 'Other' ? (reasonOther.trim() || 'Other') : reasonChoice
    setStatusSaving(true); setStatusError('')
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, resigned_at: resignDate, reason }),
    })
    setStatusSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x))
      setDeactivatingId(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setStatusError(d.error ?? 'Could not deactivate')
    }
  }

  async function reactivate(u: User) {
    setStatusSaving(true); setStatusError('')
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    })
    setStatusSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x))
    } else {
      const d = await res.json().catch(() => ({}))
      setStatusError(d.error ?? 'Could not reactivate')
    }
  }

  function roleBadge(role: string) {
    if (role === 'owner') return 'bg-purple-100 text-purple-700'
    if (role === 'manager') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
  }

  const activeUsers = users.filter(u => u.active !== false)
  const resignedUsers = users.filter(u => u.active === false)

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <button onClick={() => { setShowAdd(v => !v); setAddError('') }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New User
        </button>
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
        There&apos;s no invitation email -- the password you type in &quot;New User&quot; is their real login straight away.
        Share that username and password with them directly (WhatsApp, in person, etc.) and they can sign in immediately.
        The app doesn&apos;t track last login yet, so there&apos;s currently no way to confirm from here whether they&apos;ve actually signed in.
      </p>

      {/* Add new user form */}
      {showAdd && (
        <div className="bg-white border border-blue-300 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-gray-900">New User</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Username *</label>
              <input value={newForm.username} onChange={e => setNewForm(f => ({ ...f, username: e.target.value }))}
                placeholder="e.g. kwame" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Display Name</label>
              <input value={newForm.display_name} onChange={e => setNewForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. Kwame" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
              {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Password *</label>
              <PasswordField value={newForm.password} onChange={v => setNewForm(f => ({ ...f, password: v }))} placeholder="Min 6 chars" />
            </div>
            <div>
              <label className={labelCls}>Confirm Password *</label>
              <PasswordField value={newForm.confirm} onChange={v => setNewForm(f => ({ ...f, confirm: v }))} placeholder="Repeat" />
            </div>
          </div>
          {addError && <p className="text-red-500 text-sm">{addError}</p>}
          <div className="flex gap-2">
            <button onClick={saveNew} disabled={adding}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
              {adding ? 'Creating...' : 'Create User'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {statusError && deactivatingId === null && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{statusError}</p>}

      {/* Active user list */}
      <div className="space-y-2">
        {activeUsers.map(u => {
        // Joe's owner-level access does not extend to editing the owner's own account
        const protectedFromMe = myRole !== 'owner' && (u.role === 'owner' || u.username?.toLowerCase() === 'grony')
        const isSelf = myId === String(u.id)
        const canDeactivate = !protectedFromMe && u.role !== 'owner' && u.username?.toLowerCase() !== 'grony' && !isSelf
        return (
          <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4">
            {editId === u.id ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Editing {u.username}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Display Name</label>
                    <input value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Role</label>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                      {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>New Password</label>
                    <PasswordField value={editForm.password} onChange={v => setEditForm(f => ({ ...f, password: v }))} placeholder="Leave blank to keep" />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password</label>
                    <PasswordField value={editForm.confirm} onChange={v => setEditForm(f => ({ ...f, confirm: v }))} placeholder="Repeat" />
                  </div>
                </div>
                {editError && <p className="text-red-500 text-sm">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(u)} disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
                </div>
              </div>
            ) : deactivatingId === u.id ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Deactivate {u.display_name}?</p>
                <p className="text-xs text-gray-500">
                  Blocks @{u.username}&apos;s login immediately. Their payslips, times, and violations all stay on record —
                  they&apos;ll show up under Inactive Staff below, and can be reactivated later if needed.
                </p>
                <div>
                  <label className={labelCls}>Reason</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEACTIVATION_REASONS.map(r => (
                      <button key={r} type="button" onClick={() => setReasonChoice(r)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${reasonChoice === r ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {reasonChoice === 'Other' && (
                    <input value={reasonOther} onChange={e => setReasonOther(e.target.value)}
                      placeholder="Describe the reason" className={inputCls + ' mt-2'} />
                  )}
                </div>
                <div>
                  <label className={labelCls}>{reasonChoice === 'Suspended' ? 'Suspension Date' : 'Effective Date'}</label>
                  <input type="date" value={resignDate} onChange={e => setResignDate(e.target.value)} className={inputCls} />
                </div>
                {statusError && <p className="text-red-500 text-sm">{statusError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => confirmDeactivate(u)} disabled={statusSaving}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
                    {statusSaving ? 'Deactivating...' : 'Confirm Deactivate'}
                  </button>
                  <button onClick={() => setDeactivatingId(null)}
                    className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{u.display_name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleBadge(u.role)}`}>{u.role}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">@{u.username}</p>
                  <p className="text-xs mt-0.5">
                    {u.email
                      ? <span className="text-green-600">{u.email}</span>
                      : <span className="text-orange-400">No email set</span>}
                  </p>
                </div>
                {protectedFromMe ? (
                  <span className="shrink-0 text-xs text-gray-400 font-semibold px-3 py-1.5">Owner only</span>
                ) : (
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <button onClick={() => startEdit(u)}
                      className="text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                      Edit
                    </button>
                    {canDeactivate && (
                      <button onClick={() => startDeactivate(u)}
                        className="text-xs text-red-600 font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition">
                        Deactivate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
        })}
      </div>

      {/* Inactive Staff -- deactivated accounts, kept separate from the
          active list above but never deleted. Their payslips/times/
          violations are untouched; Reactivate just flips them back on. */}
      {resignedUsers.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inactive Staff</p>
          {resignedUsers.map(u => {
            const protectedFromMe = myRole !== 'owner' && (u.role === 'owner' || u.username?.toLowerCase() === 'grony')
            return (
              <div key={u.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3 opacity-80">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-700">{u.display_name}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{u.deactivation_reason ?? 'Resigned'}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">@{u.username}</p>
                  {u.resigned_at && <p className="text-xs text-gray-400 mt-0.5">Since {fmtDate(u.resigned_at)}</p>}
                </div>
                {!protectedFromMe && (
                  <button onClick={() => reactivate(u)} disabled={statusSaving}
                    className="shrink-0 text-xs text-green-700 font-semibold px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 disabled:opacity-40 transition">
                    Reactivate
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
