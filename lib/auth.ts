import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import sql from './db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const rows = await sql`
          SELECT id, username, display_name, role, password_hash
          FROM app_users WHERE username = ${credentials.username as string}
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
    session({ session, token }) {
      if (session.user) { (session.user as any).role = token.role; (session.user as any).username = token.username }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
