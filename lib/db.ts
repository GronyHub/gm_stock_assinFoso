import { neon } from '@neondatabase/serverless'
import { Pool } from 'pg'

// Every query used to be its own web request to Neon (about 14 in a row for one sale). Now the server keeps a few connections to the database open and reuses them, which
// removes the per-query web overhead. If a connection cannot be made (database asleep and slow to wake, a network problem), the query falls back to the old web-request
// path for a short while, so the app keeps working. DB_DRIVER=neon turns the open connections off.
//
// A statement that has already been sent is never repeated: only a failure to *connect* falls back, and only a read (SELECT) is retried after a dropped connection.

type Rows = Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
const DB_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/dummy'
const http = neon(DB_URL)

const wantPool = typeof window === 'undefined' && !!process.env.DATABASE_URL && process.env.DB_DRIVER !== 'neon' && process.env.NEXT_PHASE !== 'phase-production-build'
let pool: Pool | null = null
let downUntil = 0
let failStreak = 0 // consecutive failures: each one waits longer before the connections are tried again (30 s, 1 min, 2 min... up to 10 min)

function getPool(): Pool | null {
  if (!wantPool) return null
  if (!pool) {
    // Neon's pooled endpoint does not offer channel binding, so a 'channel_binding=require' in the connection string would only make the connection fail.
    let cs = DB_URL
    try { const u = new URL(DB_URL); u.searchParams.delete('channel_binding'); cs = u.toString() } catch { /* keep as is */ }
    pool = new Pool({ connectionString: cs, max: Number(process.env.DB_POOL_MAX || 8), idleTimeoutMillis: 60000, connectionTimeoutMillis: 3000, keepAlive: true, allowExitOnIdle: true })
    // An idle connection that the database closed (it went to sleep) must not crash the server: the pool just drops it.
    pool.on('error', () => {})
  }
  return pool
}

const CONN_ERR = /Connection terminated|connection timeout|timeout exceeded when trying to connect|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|server closed the connection|terminating connection/i
const isConnErr = (e: unknown) => e instanceof Error && (CONN_ERR.test(e.message) || CONN_ERR.test(String((e as { code?: string }).code ?? '')))
const isRead = (text: string) => /^\s*select\b/i.test(text)

async function viaPool(p: Pool, text: string, params: unknown[]): Promise<Rows> {
  let client
  try { client = await p.connect() } catch (e) { throw Object.assign(e as Error, { connectFailed: true }) }
  try {
    const r: any = await client.query(text, params.length ? params : undefined) // eslint-disable-line @typescript-eslint/no-explicit-any
    client.release()
    // Several statements in one call (only possible without parameters) answer with one result each: the last one is the answer, as before.
    const last = Array.isArray(r) ? r[r.length - 1] : r
    return (last?.rows ?? []) as Rows
  } catch (e) {
    client.release(isConnErr(e) ? (e as Error) : undefined)
    throw e
  }
}

async function run(text: string, params: unknown[]): Promise<Rows> {
  const p = Date.now() >= downUntil ? getPool() : null
  if (p) {
    try {
      const rows = await viaPool(p, text, params)
      failStreak = 0
      return rows
    } catch (e) {
      if (!isConnErr(e) && !(e as { connectFailed?: boolean }).connectFailed) throw e
      // Could not connect (nothing was sent), or a read lost its connection: use the web-request path now, and keep using it for a while (longer each time it fails again).
      downUntil = Date.now() + Math.min(600000, 30000 * 2 ** Math.min(failStreak, 5)); failStreak++
      if (!(e as { connectFailed?: boolean }).connectFailed && !isRead(text)) throw e
    }
  }
  return (await http.query(text, params)) as unknown as Rows
}

export type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Rows>
  query: (text: string, params?: unknown[]) => Promise<Rows>
}

const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
  let text = strings[0]
  for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1]
  return run(text, values)
}) as Sql
tag.query = (text: string, params: unknown[] = []) => run(text, params)

const sql: Sql = tag
export default sql
