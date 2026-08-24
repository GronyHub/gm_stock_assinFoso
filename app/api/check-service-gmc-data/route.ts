import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const services = await sql`
      SELECT
        i.id,
        i.canonical_name,
        i.purchase_rate as cost_price,
        i.expiration_date,
        i.converts_to_item_id,
        i.selling_rate as conversion_rate,
        COALESCE((SELECT COUNT(*)::int FROM stock_counts WHERE item_id = i.id), 0) as count_count,
        COALESCE((SELECT COUNT(*)::int FROM bill_lines WHERE item_id = i.id), 0) as bill_count,
        COALESCE((SELECT COUNT(*)::int FROM sales_receipt_lines WHERE item_id = i.id), 0) as sale_count,
        COALESCE((SELECT COUNT(*)::int FROM stock_count_revisions WHERE item_id = i.id), 0) as loss_count
      FROM items i
      WHERE i.gmc_type = 'service_using_gmc'
        AND i.status IS NULL
      ORDER BY i.canonical_name
    `

    const results = services.map(service => {
      const issues = []
      if (service.cost_price !== null) issues.push(`cost_price = ${service.cost_price}`)
      if (service.expiration_date !== null) issues.push(`has expiration_date`)
      if (service.count_count > 0) issues.push(`${service.count_count} stock_count records`)
      if (service.bill_count > 0) issues.push(`${service.bill_count} bill_lines`)
      if (service.sale_count > 0) issues.push(`${service.sale_count} sales_receipt_lines`)
      if (service.loss_count > 0) issues.push(`${service.loss_count} loss_revisions`)

      return {
        id: service.id,
        name: service.canonical_name,
        converts_to: service.converts_to_item_id,
        conversion_rate: service.conversion_rate,
        issues: issues.length > 0 ? issues : ['✓ Clean - no extra data'],
        has_problems: issues.length > 0,
      }
    })

    const problemServices = results.filter(r => r.has_problems)

    return success({
      total_services: results.length,
      services_with_issues: problemServices.length,
      services: results,
    })
  } catch (e) {
    return handleError('check-service-gmc-data', e)
  }
}
