// The people who sign the Company Laws and can be held to them: for now Grony, Bino, Joe and James. (Marian is not staff.)
// Add a name here when someone joins; the signature columns, the signing reminders and the violation log all follow this list.
export const SIGNERS = ['grony', 'bino', 'joe', 'james']
// The owners are never the target of a logged violation.
export const OWNER_SIGNERS = ['grony', 'joe']

// Managers: the owners and Bino. They see the managers-only laws, fix the flags, and take the managers-only checklist tiles.
export const MANAGERS = ['grony', 'bino', 'joe']
export const isManagerName = (n: string | null | undefined) => MANAGERS.includes(String(n ?? '').toLowerCase())
