import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={session.user as any} />
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
