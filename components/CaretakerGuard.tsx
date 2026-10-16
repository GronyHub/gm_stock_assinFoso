'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// The caretaker account (role children_manager) may only use the Items hub
// (where C&H lives) and her own profile. Any other page she opens by typing
// its address sends her back. Server-side, proxy.ts also refuses her the shop
// data APIs, so this is a convenience on top of a real block.
const ALLOWED = ['/item', '/profile', '/standards']

export default function CaretakerGuard() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const role = (session?.user as { role?: string } | undefined)?.role
  useEffect(() => {
    if (role !== 'children_manager') return
    if (!ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'))) router.replace('/item')
  }, [role, pathname, router])
  return null
}
