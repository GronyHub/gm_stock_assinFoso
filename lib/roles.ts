type SessionUserLike = { role?: string; username?: string; name?: string | null } | null | undefined

// Owner (Grony) and Joe hold equivalent administrative rights throughout the app.
export function isOwnerLevel(user: SessionUserLike): boolean {
  if (!user) return false
  const username = (user.username ?? user.name ?? '').toLowerCase()
  return user.role === 'owner' || username === 'joe'
}
