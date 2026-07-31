'use client'
import { useState, useEffect } from 'react'
import { FEATURE_KEYS, FEATURE_LABELS, type FeatureKey } from '@/lib/permissions'

type Role = { key: string; label: string; created_at: string }
type User = { id: number; username: string; display_name: string; role: string }
type PermMap = Record<string, Record<string, boolean>>

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'

// The table the whole feature was built for -- every role, what it can see,
// and who's actually assigned to it. Owner's row is fixed (it and username
// "grony" always have everything, hardcoded in lib/permissions.ts as a
// safety floor) so it's shown read-only rather than as togglable checkboxes
// that would be misleading -- unchecking one here would do nothing.
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [perms, setPerms] = useState<PermMap>({})
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function load() {
    Promise.all([
      fetch('/api/roles').then(r => r.json()),
      fetch('/api/users').then(r => r.json()).catch(() => []),
      fetch('/api/role-permissions').then(r => r.json()),
    ]).then(([r, u, p]) => {
      setRoles(Array.isArray(r) ? r : [])
      setUsers(Array.isArray(u) ? u : [])
      setPerms(p ?? {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function toggle(roleKey: string, feature: FeatureKey, current: boolean) {
    setToggling(`${roleKey}:${feature}`)
    setPerms(prev => ({ ...prev, [roleKey]: { ...prev[roleKey], [feature]: !current } }))
    const res = await fetch('/api/role-permissions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_key: roleKey, feature_key: feature, allowed: !current }),
    })
    setToggling(null)
    if (!res.ok) {
      // Revert on failure
      setPerms(prev => ({ ...prev, [roleKey]: { ...prev[roleKey], [feature]: current } }))
    }
  }

  async function addRole() {
    if (!newLabel.trim()) return
    setAdding(true); setAddError('')
    const res = await fetch('/api/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: newLabel.trim() }),
    })
    setAdding(false)
    if (res.ok) {
      setNewLabel(''); setShowAdd(false)
      load()
    } else {
      const d = await res.json().catch(() => null)
      setAddError(d?.error ?? 'Could not create role')
    }
  }

  async function removeRole(key: string) {
    if (!confirm(`Delete the "${key}" role? Only possible if no users currently have it.`)) return
    setDeleting(key); setDeleteError(null)
    const res = await fetch(`/api/roles?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      load()
    } else {
      const d = await res.json().catch(() => null)
      setDeleteError(d?.error ?? 'Could not delete role')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Roles &amp; Permissions</h1>
        <button onClick={() => { setShowAdd(v => !v); setAddError('') }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New Role
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-blue-300 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-gray-900">New Role</p>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Name *</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Supervisor" className={inputCls} />
          </div>
          {addError && <p className="text-red-500 text-sm">{addError}</p>}
          <div className="flex gap-2">
            <button onClick={addRole} disabled={adding || !newLabel.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
              {adding ? 'Creating...' : 'Create Role'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {deleteError && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>}

      <div className="space-y-3">
        {roles.map(role => {
          const roleUsers = users.filter(u => u.role === role.key)
          const isOwner = role.key === 'owner'
          const isBuiltIn = ['owner', 'manager', 'staff'].includes(role.key)
          return (
            <div key={role.key} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{role.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {roleUsers.length === 0 ? 'No users' : roleUsers.map(u => u.display_name).join(', ')}
                  </p>
                </div>
                {!isBuiltIn && (
                  <button onClick={() => removeRole(role.key)} disabled={deleting === role.key}
                    className="shrink-0 text-xs text-red-600 font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-40 transition">
                    {deleting === role.key ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>

              {isOwner ? (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Owner always has full access to everything (along with the username &quot;grony&quot; specifically) -- not editable here, as a safety net against ever locking out the real owner.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {FEATURE_KEYS.map(feature => {
                    const allowed = !!perms[role.key]?.[feature]
                    const busy = toggling === `${role.key}:${feature}`
                    return (
                      <label key={feature}
                        className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-2 cursor-pointer select-none hover:bg-gray-100 transition">
                        <input type="checkbox" checked={allowed} disabled={busy}
                          onChange={() => toggle(role.key, feature, allowed)}
                          className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                        <span className={busy ? 'opacity-50' : ''}>{FEATURE_LABELS[feature]}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
