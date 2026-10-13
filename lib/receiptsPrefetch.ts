// Lets the Customers wrapper start the /api/receipts request the moment the
// Cust. Receipts row is opened, in parallel with downloading the receipts
// screen's code, instead of the request only starting after that code arrived.
let pending: Promise<Response> | null = null

export function prefetchReceipts() {
  if (!pending) pending = fetch('/api/receipts')
}

// One-shot: the first load uses the prefetched response; retries and
// refreshes make fresh requests.
export function takeReceiptsPrefetch(): Promise<Response> | null {
  const p = pending
  pending = null
  return p
}
