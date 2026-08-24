import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import sql from './db'
import { logActivity } from './logger'
import { IMPERSONATE_COOKIE } from './impersonate-cookie'
import { once } from './once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`.catch(() => {})
})


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username or Email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const login = credentials.username as string
        await ensureSchema()
        const rows = await sql`
          SELECT id, username, display_name, role, password_hash, active
          FROM app_users
          WHERE username = ${login} OR email = ${login}
        `
        if (!rows.length) return null
        const user = rows[0] as { id: number; username: string; display_name: string; role: string; password_hash: string; active: boolean }
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!valid) return null
        // A resigned/deactivated staff member's credentials stop working the
        // moment an owner-level account deactivates them (see /api/users/[id]
        // PATCH) -- same "wrong username/email or password" message as any
        // other failed login, so account status isn't leaked to whoever's typing.
        if (user.active === false) return null
        return { id: String(user.id), name: user.display_name, username: user.username, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || null
        token.username = (user as { username?: string }).username || null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = (token.sub as string) ?? ''
        ;(session.user as any).role = (token.role as string | null) ?? null
        ;(session.user as any).username = (token.username as string | null) ?? null

        const realRole = (token.role as string | null) ?? null
        const realUsername = (((token.username as string) ?? '')).toLowerCase()
        const isOwnerLevel = realRole === 'owner' || realUsername === 'joe'

        // Owner/Joe can temporarily view the app as another staff member (see lib/impersonate-cookie.ts).
        // Reading the cookie can only happen inside a real request (Server Component / Route Handler);
        // guard it so an unsupported context (e.g. proxy.ts) never breaks authentication.
        if (isOwnerLevel) {
          try {
            const { cookies } = await import('next/headers')
            const store = await cookies()
            const impersonating = store.get(IMPERSONATE_COOKIE)?.value
            if (impersonating && impersonating.toLowerCase() !== realUsername) {
              const rows = await sql`SELECT username, display_name, role FROM app_users WHERE LOWER(username) = LOWER(${impersonating})`
              if (rows.length) {
                const target = rows[0] as { username: string; display_name: string; role: string }
                ;(session.user as any).realRole = realRole as string | null | undefined
                ;(session.user as any).realUsername = (token.username as string) ?? null
                session.user.realName = session.user.name
                ;(session.user as any).role = target.role
                ;(session.user as any).username = target.username
                session.user.name = target.display_name
                ;(session.user as any).impersonating = true
              }
            }
          } catch {
            // not in a readable-cookie context — leave the real session untouched
          }
        }
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  events: {
    async signIn({ user }) {
      const name = (user as { username?: string } | undefined)?.username ?? user?.name ?? 'Unknown'
      try { await logActivity(name, 'logged in', '') } catch {}
    },
    async signOut(message: any) {
      const name = message?.token?.username ?? message?.token?.name ?? message?.session?.user?.username ?? 'Unknown'
      try { await logActivity(name, 'logged out', '') } catch {}
    },
  },
})
