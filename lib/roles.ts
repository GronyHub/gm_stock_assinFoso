type SessionUserLike = { role?: string; username?: string; name?: string | null } | null | undefined

// Owner (Grony) and Joe hold equivalent administrative rights throughout the app.
export function isOwnerLevel(user: SessionUserLike): boolean {
  if (!user) return false
  const username = (user.username ?? user.name ?? '').toLowerCase()
  return user.role === 'owner' || username === 'joe'
}

// Expense categories whose amount is confidential -- only owner-level (Grony/Joe)
// can see, create, or edit them. Everyone else sees the row (so the record isn't
// hidden entirely) but with the amount redacted.
export const CONFIDENTIAL_EXPENSE_ACCOUNTS = new Set(['Salaries'])

export function isConfidentialExpense(account: string | null | undefined): boolean {
  return !!account && CONFIDENTIAL_EXPENSE_ACCOUNTS.has(account)
}
