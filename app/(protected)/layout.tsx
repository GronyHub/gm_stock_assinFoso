import { auth } from '@/lib/auth'
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
  return (
    <div className="min-h-screen flex flex-col">
      <ImpersonationBar />
      <Nav user={session.user as any} />
      <main className="flex-1 px-4 pt-4 pb-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
      <PushSubscriber />
    </div>
  )
}
