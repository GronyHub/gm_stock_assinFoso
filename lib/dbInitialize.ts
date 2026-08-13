import { ensureAdvertStatusTable } from './advertStatus'
import { ensureBillAttachmentsColumn } from './billAttachments'
import { ensureCashAtBankDeficitColumn } from './cashAtBank'
import { ensureClosingReports } from './closingReports'
import { ensureCountRevisions } from './countRevisions'
import { ensureExpenseOrders } from './expenseOrders'
import { ensureExpensePropertyColumns } from './expenseProperty'
import { ensureLiveSaleTapsTable } from './liveSaleTaps'
import { ensureManageLogs } from './manageLogs'
import { ensurePageLawsTable } from './pageLaws'
import { ensurePageNotesTable } from './pageNotes'
import { ensurePasswordResetTokens } from './passwordReset'
import { ensurePersonalSubcategoryColumn } from './personalSubcategory'
import { ensurePurchaseOrderTables } from './purchaseOrders'
import { ensureSalesAttachmentsColumn } from './salesAttachments'
import { ensureUkTables } from './ukData'

// Track if initialization has already run in this process
let initialized = false

export async function initializeDatabase() {
  if (initialized) return

  try {
    await Promise.all([
      ensureAdvertStatusTable(),
      ensureBillAttachmentsColumn(),
      ensureCashAtBankDeficitColumn(),
      ensureClosingReports(),
      ensureCountRevisions(),
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
    initialized = true
  } catch (e) {
    console.error('Database initialization failed:', e)
    // Continue anyway - individual ensure functions have their own error handling
    initialized = true
  }
}
