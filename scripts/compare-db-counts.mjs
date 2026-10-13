// After copying the database, proves nothing was lost: compares the exact row
// count of every table in the old and new databases and lists any difference.
//   OLD_DATABASE_URL=... NEW_DATABASE_URL=... node scripts/compare-db-counts.mjs
// Read-only on both sides. Exit code 1 if anything differs.
import { neon } from '@neondatabase/serverless'

const oldUrl = process.env.OLD_DATABASE_URL, newUrl = process.env.NEW_DATABASE_URL
if (!oldUrl || !newUrl) { console.error('Set OLD_DATABASE_URL and NEW_DATABASE_URL'); process.exit(1) }
const a = neon(oldUrl), b = neon(newUrl)

const tables = (await a`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`).map(r => r.table_name)
const newTables = new Set((await b`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`).map(r => r.table_name))

let bad = 0
for (const t of tables) {
  if (!newTables.has(t)) { console.log(`MISSING in new: ${t}`); bad++; continue }
  const q = `SELECT count(*)::int AS n FROM "${t.replace(/"/g, '""')}"`
  const [x, y] = await Promise.all([a.query(q), b.query(q)])
  if (x[0].n !== y[0].n) { console.log(`DIFFERENT ${t}: old ${x[0].n}, new ${y[0].n}`); bad++ }
}
console.log(`${tables.length} tables compared, ${bad} problem(s).`)
process.exit(bad ? 1 : 0)
