import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/dummy')
export default sql
