import sql from '@/lib/db'
import { once } from '@/lib/once'

async function ensureCustomerZohoColumnImpl() {
  try {
    // Check if zoho_contact_id column exists and has NOT NULL constraint
    const result = await sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'zoho_contact_id'
    `

    if (result.length > 0 && result[0].is_nullable === 'NO') {
      // Column exists with NOT NULL constraint - make it nullable
      await sql`
        ALTER TABLE customers ALTER COLUMN zoho_contact_id DROP NOT NULL
      `
      console.log('Made zoho_contact_id nullable in customers table')
    } else if (result.length === 0) {
      // Column doesn't exist - create it as nullable
      await sql`
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS zoho_contact_id TEXT
      `
      console.log('Added zoho_contact_id column to customers table')
    }
  } catch (e) {
    console.error('Error ensuring zoho_contact_id column:', e)
    // Don't throw - this shouldn't block app startup
  }
}

export const ensureCustomerZohoColumn = once(ensureCustomerZohoColumnImpl)
