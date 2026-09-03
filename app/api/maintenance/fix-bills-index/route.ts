import { success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function POST() {
  try {
    console.log('🔧 Starting bills index fix...')

    // Drop old ineffective index
    console.log('Dropping old bills_source_status_idx...')
    try {
      await sql`DROP INDEX IF EXISTS bills_source_status_idx CASCADE`
      console.log('✓ Old index dropped')
    } catch (e) {
      console.log('Index not found (already dropped or never existed)')
    }

    // Create new index optimized for actual query patterns
    console.log('Creating new bills_source_bill_date_id_idx...')
    await sql`CREATE INDEX bills_source_bill_date_id_idx ON bills (source, bill_date DESC, id DESC)`
    console.log('✓ New index created')

    // Update query planner statistics
    console.log('Running ANALYZE...')
    await sql`ANALYZE bills`
    console.log('✓ ANALYZE complete')

    console.log('✅ Bills index fix complete!')
    return success({
      message: 'Bills index fixed successfully',
      changes: [
        'Dropped bills_source_status_idx (was ineffective)',
        'Created bills_source_bill_date_id_idx (matches query patterns)',
        'Ran ANALYZE to update query planner'
      ]
    })
  } catch (e) {
    console.error('❌ Index fix error:', e)
    return handleError('maintenance/fix-bills-index', e)
  }
}
