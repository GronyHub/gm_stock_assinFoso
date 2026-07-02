import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import sql from './db'
import { logActivity } from './logger'
import { IMPERSONATE_COOKIE } from './impersonate-cookie'

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
        const rows = await sql`
          SELECT id, username, display_name, role, password_hash
          FROM app_users
          WHERE username = ${login} OR email = ${login}
        `
        if (!rows.length) return null
        const user = rows[0]
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!valid) return null
        return { id: String(user.id), name: user.display_name, username: user.username, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.username = (user as any).username }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = token.role
        ;(session.user as any).username = token.username

        const realRole = token.role as string | undefined
        const realUsername = ((token.username as string | undefined) ?? '').toLowerCase()
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
                const target = rows[0]
                ;(session.user as any).realRole = realRole
                ;(session.user as any).realUsername = token.username
                ;(session.user as any).realName = session.user.name
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
      const name = (user as any)?.username ?? user?.name ?? 'Unknown'
      try { await logActivity(name, 'logged in', '') } catch {}
    },
    async signOut(message: any) {
      const name = message?.token?.username ?? message?.token?.name ?? message?.session?.user?.username ?? 'Unknown'
      try { await logActivity(name, 'logged out', '') } catch {}
    },
  },
})
