'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type User = {
  id: number
  username: string
  display_name: string
  email: string | null
  role: string
  created_at: string
}

const ROLES = ['owner', 'manager', 'staff']

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-500 font-medium mb-1 block'

const EMPTY_NEW = { username: '', display_name: '', email: '', role: 'staff', password: '', confirm: '' }

export default function UsersPage() {
  const { data: session } = useSession()
  const myRole = (session?.user as any)?.role
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', email: '', role: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => { setUsers(data); setLoading(false) })
  }, [])

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
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
      setEditId(null)
    } else {
      const d = await res.json()
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
      setUsers(prev => [...prev, created])
      setNewForm({ ...EMPTY_NEW })
      setShowAdd(false)
    } else {
      const d = await res.json()
      setAddError(d.error ?? 'Could not create user')
    }
  }

  function roleBadge(role: string) {
    if (role === 'owner') return 'bg-purple-100 text-purple-700'
    if (role === 'manager') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <button onClick={() => { setShowAdd(v => !v); setAddError('') }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New User
        </button>
      </div>

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
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Password *</label>
              <input type="password" value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 chars" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Confirm Password *</label>
              <input type="password" value={newForm.confirm} onChange={e => setNewForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat" className={inputCls} />
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

      {/* User list */}
      <div className="space-y-2">
        {users.map(u => {
        // Joe's owner-level access does not extend to editing the owner's own account
        const protectedFromMe = myRole !== 'owner' && (u.role === 'owner' || u.username?.toLowerCase() === 'grony')
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
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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
                    <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Leave blank to keep" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password</label>
                    <input type="password" value={editForm.confirm} onChange={e => setEditForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="Repeat" className={inputCls} />
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
                  <button onClick={() => startEdit(u)}
                    className="shrink-0 text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        )
        })}
      </div>
    </div>
  )
}
