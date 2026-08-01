import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import PushSubscriber from '@/components/PushSubscriber'
import ImpersonationBar from '@/components/ImpersonationBar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let session
  try {
    session = await auth()
  } catch {
    redirect('/login')
  }
  if (!session) redirect('/login')

  // The JWT session strategy has no server-side session store to revoke, so
  // a deactivated account's existing session would otherwise keep working
  // until the token naturally expires -- authorize() in lib/auth.ts only
  // stops a NEW login. Re-checking active status here, on every protected
  // page load, closes that gap: the very next navigation after an owner
  // deactivates someone bounces them to /login, same as a fresh rejected
  // login. Fails open (stays logged in) on a DB error rather than locking
  // everyone out over a transient hiccup.
  const userId = (session.user as { id?: string })?.id
  let deactivated = false
  if (userId) {
    try {
      const [row] = await sql`SELECT active FROM app_users WHERE id = ${Number(userId)}`
      deactivated = row?.active === false
    } catch { /* fail open */ }
  }
  if (deactivated) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <div className="print:hidden">
        <ImpersonationBar />
        <Nav user={session.user as any} />
      </div>
      <main className="flex-1 px-4 pt-4 pb-6 max-w-5xl mx-auto w-full print:p-0 print:max-w-none">
        {children}
      </main>
      <PushSubscriber />
    </div>
  )
}
