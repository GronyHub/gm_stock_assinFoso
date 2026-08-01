'use client'
import { useState, useEffect } from 'react'
import { isOwnerLevel } from '@/lib/roles'
import { FEATURE_KEYS, FEATURE_LABELS, type FeatureKey } from '@/lib/permissionsShared'

export type Role = { key: string; label: string; created_at: string }
export type RoleUser = { id: number; username: string; display_name: string; role: string; active?: boolean }
type PermMap = Record<string, Record<string, boolean>>

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'

// The permissions half of what used to be the standalone /roles page --
// pulled out into its own prop-driven component so the merged Access
// screen (AccessPage.tsx) can share one users+roles fetch with the Users
// panel instead of each page fetching its own copy. Still used as-is by
// app/(protected)/roles/page.tsx for direct /roles access. Role assignment
// itself happens in UsersPanel; this screen is just for what each role/
// person can see.
//
// Access is granted per PERSON now, not per role -- a role only supplies
// the starting checkbox state the first time someone's looked up here
// (see getUserPermissionsMap in lib/permissions.ts). Owner-level accounts
// (owner role, or username "grony"/"joe") always have everything, hardcoded
// as a safety floor, so they show as a fixed checkmark rather than a
// togglable box that would be misleading.
export default function RolesPanel({ roles, setRoles, users }: {
  roles: Role[]
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>
  users: RoleUser[]
}) {
  const [perms, setPerms] = useState<PermMap>({})
  const [loadingPerms, setLoadingPerms] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function loadPerms() {
    fetch('/api/user-permissions').then(r => r.json())
      .then(p => { setPerms(p ?? {}); setLoadingPerms(false) })
      .catch(() => setLoadingPerms(false))
  }
  useEffect(() => { loadPerms() }, [])

  const activeUsers = users.filter(u => u.active !== false)

  async function toggle(user: RoleUser, feature: FeatureKey, current: boolean) {
    const key = user.username.toLowerCase()
    const cellKey = `${user.id}:${feature}`
    setToggling(cellKey)
    setPerms(prev => ({ ...prev, [key]: { ...prev[key], [feature]: !current } }))
    const res = await fetch('/api/user-permissions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, feature_key: feature, allowed: !current }),
    })
    setToggling(null)
    if (!res.ok) {
      // Revert on failure
      setPerms(prev => ({ ...prev, [key]: { ...prev[key], [feature]: current } }))
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
      const created = await res.json()
      setRoles(prev => [...prev, created])
      setNewLabel(''); setShowAdd(false)
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
      setRoles(prev => prev.filter(r => r.key !== key))
    } else {
      const d = await res.json().catch(() => null)
      setDeleteError(d?.error ?? 'Could not delete role')
    }
  }

  if (loadingPerms) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4 space-y-6">
      <div className="space-y-3">
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

        <div className="flex flex-wrap gap-2">
          {roles.map(role => {
            const roleUsers = users.filter(u => u.role === role.key)
            const isBuiltIn = ['owner', 'manager', 'staff'].includes(role.key)
            return (
              <div key={role.key} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{role.label}</p>
                  <p className="text-[11px] text-gray-400">
                    {roleUsers.length === 0 ? 'No users' : roleUsers.map(u => u.display_name).join(', ')}
                  </p>
                </div>
                {!isBuiltIn && (
                  <button onClick={() => removeRole(role.key)} disabled={deleting === role.key}
                    className="shrink-0 text-xs text-red-600 font-semibold px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-40 transition">
                    {deleting === role.key ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-gray-900">Access by person</p>
        <p className="text-xs text-gray-400">
          Check a box to grant that person a feature, uncheck to remove it. New hires start with whatever their role already grants.
        </p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          {/* border-separate, not border-collapse -- position: sticky on a
              <td>/<th> is unreliable in collapsed-border tables (the sticky
              column can end up sized too narrow for its own content, so a
              long permission label visibly overflows into the columns next
              to it instead of the table just being exactly as wide as it
              needs). Explicit opaque row backgrounds (no /60 alpha) so the
              sticky column fully covers whatever scrolls underneath it. */}
          <table className="text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white w-32 max-w-[8rem] text-left font-semibold text-gray-500 text-xs px-3 py-2.5 border-b border-gray-200 whitespace-nowrap">
                  Permission
                </th>
                {activeUsers.map(u => (
                  <th key={u.id} className="text-center font-semibold text-gray-700 text-xs px-3 py-2.5 border-b border-l border-gray-100 whitespace-nowrap">
                    {u.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_KEYS.map((feature, i) => (
                <tr key={feature} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="sticky left-0 z-10 bg-inherit w-32 max-w-[8rem] text-gray-700 text-xs px-3 py-2.5 border-b border-gray-100">
                    {FEATURE_LABELS[feature]}
                  </td>
                  {activeUsers.map(u => {
                    if (isOwnerLevel(u as { role?: string; username?: string })) {
                      return (
                        <td key={u.id} title="Always has full access" className="text-center px-3 py-2.5 border-b border-l border-gray-100 text-green-600">
                          ✓
                        </td>
                      )
                    }
                    const allowed = !!perms[u.username.toLowerCase()]?.[feature]
                    const busy = toggling === `${u.id}:${feature}`
                    return (
                      <td key={u.id} className="text-center px-3 py-2.5 border-b border-l border-gray-100">
                        <input type="checkbox" checked={allowed} disabled={busy}
                          onChange={() => toggle(u, feature, allowed)}
                          className={`w-3.5 h-3.5 accent-blue-600 ${busy ? 'opacity-50' : ''}`} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
