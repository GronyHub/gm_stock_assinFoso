import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const out: Record<string, unknown> = {}

  try {
    out.staff_profiles_columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'staff_profiles' AND column_name IN ('has_company_tshirt', 'tshirt_due_date')
    `
  } catch (e) { out.staff_profiles_columns_error = String(e) }

  try {
    out.user_permissions_table = await sql`SELECT to_regclass('public.user_permissions') AS exists`
    out.user_permissions_count = await sql`SELECT COUNT(*)::int AS n FROM user_permissions`
    out.user_permissions_uk_rows = await sql`
      SELECT up.user_id, u.username, up.feature_key, up.allowed
      FROM user_permissions up JOIN app_users u ON u.id = up.user_id
      WHERE up.feature_key = 'uk'
    `
  } catch (e) { out.user_permissions_error = String(e) }

  try {
    out.custom_tasks_table = await sql`SELECT to_regclass('public.custom_tasks') AS exists`
    out.custom_tasks_sample = await sql`SELECT id, title, submenu, view, done FROM custom_tasks ORDER BY id DESC LIMIT 10`
  } catch (e) { out.custom_tasks_error = String(e) }

  try {
    out.app_users = await sql`SELECT id, username, role, active FROM app_users ORDER BY id`
  } catch (e) { out.app_users_error = String(e) }

  try {
    out.staff_profiles_tshirt_sample = await sql`
      SELECT staff_name, has_company_tshirt, tshirt_due_date::text FROM staff_profiles ORDER BY staff_name
    `
  } catch (e) { out.staff_profiles_tshirt_error = String(e) }

  try {
    out.closing_reports_no_tshirt_sample = await sql`
      SELECT work_date::text, no_tshirt_staff FROM closing_reports
      WHERE no_tshirt_staff IS NOT NULL AND TRIM(no_tshirt_staff) <> ''
      ORDER BY work_date DESC LIMIT 10
    `
  } catch (e) { out.closing_reports_error = String(e) }

  // A4 SHEETS DOUBLE A investigation
  try {
    out.a4_items = await sql`
      SELECT id, canonical_name, cf_group, status
      FROM items
      WHERE canonical_name ILIKE '%A4%DOUBLE%A%' OR canonical_name ILIKE '%DOUBLE A%A4%'
      ORDER BY canonical_name
    `
  } catch (e) { out.a4_items_error = String(e) }

  try {
    out.bill_2026_07_30 = await sql`
      SELECT id, bill_number, bill_date::text, vendor_name, total
      FROM bills WHERE bill_date::date = '2026-07-30'
      ORDER BY id
    `
  } catch (e) { out.bill_error = String(e) }

  try {
    out.bill_lines_2026_07_30 = await sql`
      SELECT bl.id, bl.bill_id, bl.item_id, bl.raw_item_name, bl.resolved_name, bl.quantity, bl.rate,
             i.canonical_name, i.cf_group, i.status
      FROM bill_lines bl
      JOIN bills b ON b.id = bl.bill_id
      LEFT JOIN items i ON i.id = bl.item_id
      WHERE b.bill_date::date = '2026-07-30'
      ORDER BY bl.bill_id, bl.id
    `
  } catch (e) { out.bill_lines_error = String(e) }

  return NextResponse.json(out)
}
