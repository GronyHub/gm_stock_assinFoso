// Runs a schema-setup function at most once per server process instead of
// once per request.
//
// Every `ensureXTable()` in lib/ is a pile of CREATE TABLE IF NOT EXISTS /
// ALTER TABLE ... IF NOT EXISTS statements. They're idempotent, so calling
// them repeatedly is *correct* -- but each call is still a real round trip
// to Neon, and they run before the route's actual query. On a hot route
// that's double (or, for the ten-statement ones, eleven times) the database
// traffic it needs, on every single request, forever, to re-confirm a
// migration that has already been applied.
//
// The returned function caches the in-flight promise, so concurrent callers
// share one execution and later callers get the resolved result for free.
// A rejection clears the cache so the next call retries rather than
// permanently caching a failure -- in practice the ensure functions swallow
// their own errors, so this is just belt-and-braces.
//
// Per *process*, not globally: a fresh serverless instance re-runs each
// ensure once on its first request, which is exactly the behaviour that
// makes the pattern safe to begin with.
export function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = fn().catch(err => {
        cached = null
        throw err
      })
    }
    return cached
  }
}
