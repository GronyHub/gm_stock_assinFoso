'use client'
import { useState, useEffect } from 'react'
import UsersPanel, { type User, type Role } from './UsersPanel'

// Thin fetch-and-render wrapper so /users keeps working as a direct route --
// the actual UI lives in UsersPanel, shared with the merged Access screen
// (see AccessPage.tsx) which fetches users+roles once for both this and
// RolesPanel instead of each page fetching its own copy.
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => { setUsers(Array.isArray(data) ? data : []); setLoading(false) })
    fetch('/api/roles').then(r => r.json()).then(data => setRoles(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return <UsersPanel users={users} setUsers={setUsers} roles={roles} />
}
