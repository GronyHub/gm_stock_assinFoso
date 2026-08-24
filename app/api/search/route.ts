import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { hasFeature, getUserPermissionsMap } from '@/lib/permissions'
import { CH_ITEMS } from '@/app/(protected)/item/_components/chViewData'
import { NextRequest } from 'next/server'

// Backs the global search (top row, next to Grony Cash/Grony Manage) --
// separate from the per-view search bars already on most tabs, which only
// filter whatever's already on screen. This looks across the handful of
// things someone might actually be hunting for by name/number without
// knowing which section it lives in. Each table is queried independently
// and swallows its own error so one missing/renamed column can't take the
// whole search down.
//
// Scoped by the same Roles & Permissions features that gate the Biz/UK/C&H
// icons themselves (see hasFeature/getUserPermissionsMap) -- Grony (owner)
// reaches all three, most staff only reach Biz, so results are filtered
// server-side rather than just hidden client-side, since this is real
// business/private-family data that shouldn't round-trip to a browser that
// isn't allowed to see it in the first place.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 2) return success({})
    const like = `%${q}%`

    const permissionsMap = await getUserPermissionsMap()
    const user = session!.user as { role?: string | null; username?: string | null; name?: string | null }
    const canSeeCash = hasFeature(user, 'cash', permissionsMap)
    const canSeeUK = hasFeature(user, 'uk', permissionsMap)
    const canSeeCH = hasFeature(user, 'ch', permissionsMap)

  const [items, customers, vendors, sales, bills, announcements] = canSeeCash
    ? await Promise.all([
        sql`
          SELECT id, canonical_name AS name, cf_group
          FROM active_items
          WHERE canonical_name ILIKE ${like}
          ORDER BY canonical_name LIMIT 6
        `.catch(() => []),
        sql`
          SELECT id, display_name, company_name
          FROM customers
          WHERE display_name ILIKE ${like} OR company_name ILIKE ${like}
          ORDER BY display_name LIMIT 6
        `.catch(() => []),
        sql`
          SELECT id, display_name, company_name
          FROM vendors
          WHERE display_name ILIKE ${like} OR company_name ILIKE ${like}
          ORDER BY display_name LIMIT 6
        `.catch(() => []),
        sql`
          SELECT id, receipt_number, customer_name, receipt_date::date AS receipt_date
          FROM sales_receipts
          WHERE receipt_number ILIKE ${like} OR customer_name ILIKE ${like}
          ORDER BY receipt_date DESC LIMIT 6
        `.catch(() => []),
        sql`
          SELECT id, bill_number, vendor_name, bill_date::date AS bill_date
          FROM bills
          WHERE bill_number ILIKE ${like} OR vendor_name ILIKE ${like}
          ORDER BY bill_date DESC LIMIT 6
        `.catch(() => []),
        sql`
          SELECT id, body, author, created_at
          FROM announcements
          WHERE body ILIKE ${like} OR author ILIKE ${like}
          ORDER BY created_at DESC LIMIT 6
        `.catch(() => []),
      ])
    : [[], [], [], [], [], []]

  const [ukSubmenus, ukEntries] = canSeeUK
    ? await Promise.all([
        sql`
          SELECT id, person, name
          FROM uk_submenus
          WHERE name ILIKE ${like}
          ORDER BY person, sort_order LIMIT 6
        `.catch(() => []),
        sql`
          SELECT r.id AS row_id, s.id AS submenu_id, s.person, s.name AS submenu_name, c.name AS column_name, ce.value
          FROM uk_cells ce
          JOIN uk_rows r ON r.id = ce.row_id
          JOIN uk_columns c ON c.id = ce.column_id
          JOIN uk_submenus s ON s.id = r.submenu_id
          WHERE ce.value ILIKE ${like}
          ORDER BY r.created_at DESC LIMIT 6
        `.catch(() => []),
      ])
    : [[], []]

  const chCategories = CH_ITEMS.map(i => i.key)
  const chLabelByCategory = new Map<string, string>(CH_ITEMS.map(i => [i.key, i.label]))
  const [chLogsRaw] = canSeeCH
    ? await Promise.all([
        sql`
          SELECT id, category, notes, log_date::text, logged_by
          FROM manage_logs
          WHERE category = ANY(${chCategories}) AND notes ILIKE ${like}
          ORDER BY log_date DESC, created_at DESC LIMIT 6
        `.catch(() => []),
      ])
    : [[]]
  const chLogs = (chLogsRaw as { id: number; category: string; notes: string; log_date: string; logged_by: string }[])
    .map(l => ({ ...l, category_label: chLabelByCategory.get(l.category) ?? l.category }))

    return success({ items, customers, vendors, sales, bills, announcements, ukSubmenus, ukEntries, chLogs })
  } catch (e) {
    return handleError('search GET', e)
  }
}
