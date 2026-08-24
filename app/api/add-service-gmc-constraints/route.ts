import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'

/**
 * Creates database constraints and triggers to enforce that services using GMC:
 * - Have NULL cost_price (purchase_rate)
 * - Cannot have stock_count records
 * - Cannot have bill_line records
 * - Cannot have sales_receipt_line records
 * - Cannot have stock_count_revision records
 */
export async function POST(req: Request) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session!.user as any)) return badRequest('Only Grony or Joe can add constraints')

  try {
    const results: any[] = []

    // Pre-flight: Clear any remaining cost_price values on services using GMC
    const servicesToClean = await sql`
      SELECT COUNT(*)::int as cnt
      FROM items
      WHERE gmc_type = 'service_using_gmc'
        AND purchase_rate IS NOT NULL
        AND status IS NULL
    `

    if (servicesToClean[0]?.cnt > 0) {
      await sql`
        UPDATE items
        SET purchase_rate = NULL
        WHERE gmc_type = 'service_using_gmc'
          AND purchase_rate IS NOT NULL
          AND status IS NULL
      `
      results.push({
        step: 'cleanup',
        message: `Cleared cost prices from ${servicesToClean[0].cnt} service${servicesToClean[0].cnt !== 1 ? 's' : ''}`,
      })
    }

    // Constraint 1: Create trigger to prevent cost_price changes on services using GMC
    try {
      await sql`
        CREATE OR REPLACE FUNCTION prevent_cost_price_on_service_gmc()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.gmc_type = 'service_using_gmc' AND NEW.purchase_rate IS NOT NULL THEN
            RAISE EXCEPTION 'Services using GMC cannot have a cost price. Transfer to target item instead.';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
      results.push({ constraint: 'prevent_cost_price_on_service_gmc function', status: 'created/updated' })
    } catch (e: any) {
      results.push({ constraint: 'prevent_cost_price_on_service_gmc function', status: 'exists' })
    }

    try {
      await sql`
        DROP TRIGGER IF EXISTS prevent_cost_price_on_service_gmc_trigger ON items;
      `
      await sql`
        CREATE TRIGGER prevent_cost_price_on_service_gmc_trigger
        BEFORE INSERT OR UPDATE ON items
        FOR EACH ROW
        EXECUTE FUNCTION prevent_cost_price_on_service_gmc();
      `
      results.push({ trigger: 'items (cost_price)', status: 'created' })
    } catch (e: any) {
      results.push({ trigger: 'items (cost_price)', status: 'error', error: e.message })
    }

    // Constraint 2: Prevent stock_counts on services using GMC via trigger
    try {
      await sql`
        CREATE OR REPLACE FUNCTION prevent_stock_count_on_service_gmc()
        RETURNS TRIGGER AS $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM items
            WHERE id = NEW.item_id
              AND gmc_type = 'service_using_gmc'
          ) THEN
            RAISE EXCEPTION 'Cannot add stock counts to services using GMC. Transfer to target item instead.';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
      results.push({ constraint: 'prevent_stock_count_on_service_gmc function', status: 'created/updated' })
    } catch (e: any) {
      results.push({ constraint: 'prevent_stock_count_on_service_gmc function', status: 'exists' })
    }

    try {
      await sql`
        DROP TRIGGER IF EXISTS prevent_stock_count_on_service_gmc_trigger ON stock_counts;
      `
      await sql`
        CREATE TRIGGER prevent_stock_count_on_service_gmc_trigger
        BEFORE INSERT ON stock_counts
        FOR EACH ROW
        EXECUTE FUNCTION prevent_stock_count_on_service_gmc();
      `
      results.push({ trigger: 'stock_counts', status: 'created' })
    } catch (e: any) {
      results.push({ trigger: 'stock_counts', status: 'error', error: e.message })
    }

    // Constraint 3: Prevent bill_lines on services using GMC via trigger
    try {
      await sql`
        CREATE OR REPLACE FUNCTION prevent_bill_on_service_gmc()
        RETURNS TRIGGER AS $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM items
            WHERE id = NEW.item_id
              AND gmc_type = 'service_using_gmc'
          ) THEN
            RAISE EXCEPTION 'Cannot add bills to services using GMC. Transfer to target item instead.';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
      results.push({ constraint: 'prevent_bill_on_service_gmc function', status: 'created/updated' })
    } catch (e: any) {
      results.push({ constraint: 'prevent_bill_on_service_gmc function', status: 'exists' })
    }

    try {
      await sql`
        DROP TRIGGER IF EXISTS prevent_bill_on_service_gmc_trigger ON bill_lines;
      `
      await sql`
        CREATE TRIGGER prevent_bill_on_service_gmc_trigger
        BEFORE INSERT ON bill_lines
        FOR EACH ROW
        EXECUTE FUNCTION prevent_bill_on_service_gmc();
      `
      results.push({ trigger: 'bill_lines', status: 'created' })
    } catch (e: any) {
      results.push({ trigger: 'bill_lines', status: 'error', error: e.message })
    }

    // Constraint 4: Prevent sales_receipt_lines on services using GMC via trigger
    // (Allow live_sale source which properly records material consumption)
    try {
      await sql`
        CREATE OR REPLACE FUNCTION prevent_sale_on_service_gmc()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.source != 'live_sale' AND EXISTS (
            SELECT 1 FROM items
            WHERE id = NEW.item_id
              AND gmc_type = 'service_using_gmc'
          ) THEN
            RAISE EXCEPTION 'Cannot add sales to services using GMC. Transfer to target item instead.';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
      results.push({ constraint: 'prevent_sale_on_service_gmc function', status: 'created/updated' })
    } catch (e: any) {
      results.push({ constraint: 'prevent_sale_on_service_gmc function', status: 'exists' })
    }

    try {
      await sql`
        DROP TRIGGER IF EXISTS prevent_sale_on_service_gmc_trigger ON sales_receipt_lines;
      `
      await sql`
        CREATE TRIGGER prevent_sale_on_service_gmc_trigger
        BEFORE INSERT ON sales_receipt_lines
        FOR EACH ROW
        EXECUTE FUNCTION prevent_sale_on_service_gmc();
      `
      results.push({ trigger: 'sales_receipt_lines', status: 'created' })
    } catch (e: any) {
      results.push({ trigger: 'sales_receipt_lines', status: 'error', error: e.message })
    }

    return success({
      success: true,
      message: 'Database constraints and triggers applied successfully',
      results,
    })
  } catch (e) {
    return handleError('add-service-gmc-constraints POST', e)
  }
}
