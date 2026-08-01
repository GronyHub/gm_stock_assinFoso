'use client'
import { useState, useEffect } from 'react'
import RolesPanel, { type Role, type RoleUser } from './RolesPanel'

// Thin fetch-and-render wrapper so /roles keeps working as a direct route --
// the actual UI lives in RolesPanel, shared with the merged Access screen
// (see AccessPage.tsx) which fetches users+roles once for both this and
// UsersPanel instead of each page fetching its own copy.
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<RoleUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/roles').then(r => r.json()),
      fetch('/api/users').then(r => r.json()).catch(() => []),
    ]).then(([r, u]) => {
      setRoles(Array.isArray(r) ? r : [])
      setUsers(Array.isArray(u) ? u : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return <RolesPanel roles={roles} setRoles={setRoles} users={users} />
}
