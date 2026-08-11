'use client'
import { useState, useEffect } from 'react'
import UsersPanel, { type User, type Role } from '../../users/UsersPanel'
import RolesPanel, { type RoleUser } from '../../roles/RolesPanel'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'

// Users and Roles & Permissions used to be two separate pages you had to
// navigate between for one connected task -- assign someone a role here,
// then leave and go find that role's permissions over there to see or
// change what it actually grants. This fetches users+roles once and hands
// them to both existing panels (unchanged, still usable standalone at
// /users and /roles) behind a single tab switcher instead.
export default function AccessPage({ initialTab, canSeeUsers, canSeeRoles }: {
  initialTab: 'users' | 'roles'
  canSeeUsers: boolean
  canSeeRoles: boolean
}) {
  const [tab, setTab] = useState<'users' | 'roles'>(!canSeeUsers && canSeeRoles ? 'roles' : initialTab)
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const lawsPanel = useLawsPanel('showAccessLaws')

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/roles').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([u, r]) => {
      setUsers(Array.isArray(u) ? u : [])
      setRoles(Array.isArray(r) ? r : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  const roleUsers: RoleUser[] = users.map(u => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role, active: u.active }))

  return (
    <div className="space-y-2">
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags} dark={false} />
      </div>
      {lawsPanel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <PageLawsList scopeKey={tab === 'roles' ? 'Roles' : 'Users'} isItemsLaws={true} onChange={lawsPanel.bumpRefresh}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags} />
        </div>
      )}
      {canSeeUsers && canSeeRoles && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setTab('users')}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            👤 Users
          </button>
          <button onClick={() => setTab('roles')}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${tab === 'roles' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            🛡️ Roles &amp; Permissions
          </button>
        </div>
      )}
      {/* Kept mounted (not conditionally rendered) so switching tabs back
          and forth doesn't refetch role-permissions or lose either panel's
          in-progress form state. */}
      <div className={tab === 'users' ? '' : 'hidden'}>
        {canSeeUsers && <UsersPanel users={users} setUsers={setUsers} roles={roles} />}
      </div>
      <div className={tab === 'roles' ? '' : 'hidden'}>
        {canSeeRoles && <RolesPanel roles={roles} setRoles={setRoles} users={roleUsers} />}
      </div>
    </div>
  )
}
