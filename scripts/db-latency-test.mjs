// Measures round-trip time to one or more databases, from wherever it runs.
// Run it ON THE DROPLET (that's the machine whose speed matters):
//   OLD_DATABASE_URL=... NEW_DATABASE_URL=... node scripts/db-latency-test.mjs
// Prints the median/min/max of 15 `SELECT 1` calls per database, plus one
// realistic multi-table query. Does not write anything.
import { neon } from '@neondatabase/serverless'

const targets = Object.entries({
  old: process.env.OLD_DATABASE_URL || process.env.DATABASE_URL,
  new: process.env.NEW_DATABASE_URL,
}).filter(([, url]) => url)

if (targets.length === 0) { console.error('Set OLD_DATABASE_URL and/or NEW_DATABASE_URL'); process.exit(1) }

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]

for (const [name, url] of targets) {
  const sql = neon(url)
  await sql`SELECT 1` // warm: wakes the compute and opens the connection
  const times = []
  for (let i = 0; i < 15; i++) {
    const t = performance.now()
    await sql`SELECT 1`
    times.push(performance.now() - t)
  }
  // The same small join, 5 times: the first run is often slower (cold cache),
  // the later ones show the steady-state cost.
  const heavy = []
  try {
    for (let i = 0; i < 5; i++) {
      const t = performance.now()
      await sql`SELECT count(*) FROM sales_receipts sr LEFT JOIN customers c ON c.id = sr.customer_id`
      heavy.push(performance.now() - t)
    }
  } catch {}
  console.log(`${name.padEnd(4)} SELECT 1: median ${median(times).toFixed(0)} ms, min ${Math.min(...times).toFixed(0)}, max ${Math.max(...times).toFixed(0)}`
    + (heavy.length ? ` | join query runs (ms): ${heavy.map(h => h.toFixed(0)).join(', ')}` : ''))
}
