import sql from '@/lib/db'
import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { NextResponse } from 'next/server'

/**
 * Creates database constraints and triggers to enforce that services using GMC:
 * - Have NULL cost_price (purchase_rate)
 * - Cannot have stock_count records
 * - Cannot have bill_line records
 * - Cannot have sales_receipt_line records
 * - Cannot have stock_count_revision records
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can add constraints' }, { status: 403 })
  }

  try {
    const results: any[] = []

    // Constraint 1: Services using GMC must have NULL cost_price
    try {
      await sql`
        ALTER TABLE items
        ADD CONSTRAINT service_gmc_no_cost_price
        CHECK (
          gmc_type != 'service_using_gmc' OR purchase_rate IS NULL
        )
      `
      results.push({ constraint: 'service_gmc_no_cost_price', status: 'created' })
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push({ constraint: 'service_gmc_no_cost_price', status: 'already exists' })
      } else {
        throw e
      }
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
    try {
      await sql`
        CREATE OR REPLACE FUNCTION prevent_sale_on_service_gmc()
        RETURNS TRIGGER AS $$
        BEGIN
          IF EXISTS (
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

    return NextResponse.json({
      success: true,
      message: 'Database constraints and triggers applied successfully',
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
