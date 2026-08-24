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

let allInitialized = false
const initPromise = initializeAllAsync()

async function initializeAllAsync() {
  try {
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
    allInitialized = true
  } catch (e) {
    console.error('Database initialization failed:', e)
    allInitialized = true // mark as done even on error so we don't retry forever
  }
}

export async function ensureDbInitialized() {
  if (allInitialized) return
  await initPromise
}
