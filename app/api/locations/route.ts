import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

// Locations aren't a separate managed entity -- just the distinct values
// already saved on customers AND vendors (pooled, since the same town
// applies to either), offered back as suggestions so a new record's
// location gets picked from what's already in use (or added as a
// genuinely new one) instead of a free-typed near-duplicate variant.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  await sql`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  await ensureLocationsTable()

  const customersVendorsRows = await sql`
    SELECT location FROM customers WHERE location IS NOT NULL AND location <> ''
    UNION
    SELECT location FROM vendors WHERE location IS NOT NULL AND location <> ''
  `
  const managedRows = await sql`SELECT location FROM managed_locations ORDER BY location`

  const allLocations = new Set<string>()
  customersVendorsRows.forEach((r: any) => {
    if (r.location) allLocations.add(r.location)
  })
  managedRows.forEach((r: any) => {
    if (r.location) allLocations.add(r.location)
  })

  return success(Array.from(allLocations).sort())
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { location } = await req.json()
  if (!location || typeof location !== 'string') {
    return badRequest('Location is required.')
  }

  const name = location.trim()
  if (!name) {
    return badRequest('Location cannot be empty.')
  }

  try {
    await ensureLocationsTable()

    // Check if already exists
    const existing = await sql`SELECT 1 FROM managed_locations WHERE location = ${name}`
    if (existing.length > 0) {
      return badRequest('This location already exists.')
    }

    // Add new location
    await sql`INSERT INTO managed_locations (location) VALUES (${name})`
    return success({ location: name })
  } catch (e) {
    return handleError('add location', e)
  }
}

const ensureLocationsTable = once(async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS managed_locations (
        location TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `
  } catch (e) {
    console.error('Error ensuring locations table:', e)
  }
})
