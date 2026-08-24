import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    username: string
    role: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string | null
      username?: string | null
      realRole?: string | null
      realUsername?: string | null
      realName?: string | null
      impersonating?: boolean
    }
  }

  interface JWT {
    sub?: string
    role?: string | null | undefined
    username?: string | null | undefined
  }
}
