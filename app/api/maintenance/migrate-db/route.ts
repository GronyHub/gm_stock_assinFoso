import { success, handleError } from '@/lib/api'
import { ensureAdvertStatusTable } from '@/lib/advertStatus'
import { ensureBillAttachmentsColumn } from '@/lib/billAttachments'
import { ensureCashAtBankDeficitColumn } from '@/lib/cashAtBank'
import { ensureClosingReports } from '@/lib/closingReports'
import { ensureCountRevisions } from '@/lib/countRevisions'
import { ensureCustomerZohoColumn } from '@/lib/customerZohoColumn'
import { ensureExpenseOrders } from '@/lib/expenseOrders'
import { ensureExpensePropertyColumns } from '@/lib/expenseProperties'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { ensureManageLogs } from '@/lib/manageLogs'
import { ensurePageLawsTable } from '@/lib/pageLaws'
import { ensurePageNotesTable } from '@/lib/pageNotes'
import { ensurePasswordResetTokens } from '@/lib/passwordResetTokens'
import { ensurePersonalSubcategoryColumn } from '@/lib/personalLedger'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { ensureSalesAttachmentsColumn } from '@/lib/salesAttachments'
import { ensureUkTables } from '@/lib/ukTables'

// Database schema migrations - run once at deployment
// This endpoint is called by Vercel cron or manual curl, NOT by API routes
export async function POST() {
  try {
    console.log('🚀 Starting database migrations...')

    await Promise.all([
      ensureAdvertStatusTable(),
      ensureBillAttachmentsColumn(),
      ensureCashAtBankDeficitColumn(),
      ensureClosingReports(),
      ensureCountRevisions(),
      ensureCustomerZohoColumn(),
      ensureExpenseOrders(),
      ensureExpensePropertyColumns(),
      ensureLiveSaleTapsTable(),
      ensureManageLogs(),
      ensurePageLawsTable(),
      ensurePageNotesTable(),
      ensurePasswordResetTokens(),
      ensurePersonalSubcategoryColumn(),
      ensurePurchaseOrderTables(),
      ensureSalesAttachmentsColumn(),
      ensureUkTables(),
    ])

    console.log('✅ Database migrations complete')
    return success({
      message: 'All database migrations completed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    console.error('❌ Migration error:', e)
    return handleError('maintenance/migrate-db', e)
  }
}
