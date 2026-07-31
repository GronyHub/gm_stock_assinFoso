import sql from '@/lib/db'

// Shared by /api/auth/forgot-password (creates a token) and
// /api/auth/reset-password (consumes one) -- both need the table to exist
// before querying it. No migration ever created this table explicitly, so
// if it was never created by hand on the live database, every reset
// request would fail with a generic "Something went wrong" on the client
// (the route had no try/catch surfacing the real error).
export async function ensurePasswordResetTokens() {
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}
