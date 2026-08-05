import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { del } from '@vercel/blob'
import { NextResponse } from 'next/server'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const [row] = await sql`DELETE FROM uk_submenu_files WHERE id = ${Number(id)} RETURNING file_url`
  if (row?.file_url) {
    const pathname = new URL(row.file_url, 'https://x').searchParams.get('p')
    if (pathname) await del(pathname).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
