import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import BottomNav from '@/components/BottomNav'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as any)?.role ?? 'staff'
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={session.user as any} />
      <main className="flex-1 px-4 pt-4 pb-32 md:pb-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
      <BottomNav role={role} />
    </div>
  )
}
