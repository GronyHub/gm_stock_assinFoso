// Minimal types for the parts of 'pg' that lib/db.ts uses (the package ships no types and @types/pg is not installed).
declare module 'pg' {
  export interface PoolConfig { connectionString?: string; max?: number; idleTimeoutMillis?: number; connectionTimeoutMillis?: number; keepAlive?: boolean; allowExitOnIdle?: boolean }
  export interface PoolClient { query(text: string, values?: unknown[]): Promise<any>; release(err?: Error | boolean): void } // eslint-disable-line @typescript-eslint/no-explicit-any
  export class Pool { constructor(config?: PoolConfig); connect(): Promise<PoolClient>; on(event: 'error', listener: (err: Error) => void): this; end(): Promise<void> }
}
