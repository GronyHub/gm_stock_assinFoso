import { NextResponse } from 'next/server'

// This endpoint is deprecated. Daily sales are now automatically consolidated
// from both New Sale (sales_receipts) and Live Sale (live_sale_taps) in the
// analytics summary API without needing separate "Sale" entries.
export async function POST() {
  return NextResponse.json({
    error: 'This endpoint is deprecated. Daily sales are automatically consolidated in analytics.',
  }, { status: 410 })
}
