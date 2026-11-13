// Purchase Orders guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'purchase_orders',
  nav: '📑 Purchase Orders',
  url: '/item?tab=loss&view=purchaseOrders',
  mock(p, m, q, body) {
    if (p === '/api/purchase-orders' && m === 'GET') return S.pos
    let mm = p.match(/^\/api\/purchase-orders\/(\d+)$/)
    if (mm && m === 'GET') { const po = S.pos.find(x => x.id === Number(mm[1])); return { ...po, receipts: [], discrepancies: [] } }
    mm = p.match(/^\/api\/purchase-orders\/(\d+)\/receive$/)
    if (mm && m === 'POST') {
      const po = S.pos.find(x => x.id === Number(mm[1]))
      ;(body.lines || []).forEach(l => { const pl = po.lines.find(x => x.id === l.poLineId); if (pl) pl.qty_received = String(Number(pl.qty_received) + Number(l.qty)) })
      return { ok: true }
    }
    if (p === '/api/vendors') return S.vendors
  },
  steps: [
    { caption: '<b>Purchase Orders</b>: what we order from suppliers',
      say: 'This is Purchase Orders, for what we order from suppliers before the goods arrive. Each order shows its vendor and its dates.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'A new order: <b>+ New PO</b>',
      say: 'To make an order, tap plus New P O. Pick the vendor and the dates, add each item with its quantity and price, then send it to the supplier on WhatsApp.',
      run: async (h, page) => { await h.point(page.getByText('+ New PO').first()) } },

    { caption: 'When the goods arrive: open the order',
      say: 'When the goods arrive, open the order by tapping it. Its items show how much was ordered.',
      run: async (h, page) => { await h.tap(page.getByText('Kwame Paper').first()); await h.wait(1500) } },

    { caption: 'Tap <b>Receive Items</b>',
      say: 'Tap Receive Items.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'Receive Items' })); await h.wait(1200) } },

    { caption: 'Type the quantity that <b>really arrived</b>',
      say: 'Type the quantity you actually received, for each item. Count them, do not just copy the order.',
      run: async (h, page) => {
        const q = page.locator('input[type=number]'); const n = await q.count()
        const first = q.nth(0); await h.tap(first); await first.press('Control+a'); await h.type(first, '38')
        await h.wait(500)
      } },

    { caption: 'Tap <b>Confirm Receipt</b>',
      say: 'Then tap Confirm Receipt. The stock goes up, and the delivery is kept in Receiving History.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'Confirm Receipt' }).first()); await h.wait(2500) } },

    { caption: '<b>Check vs Bills</b>: order against the supplier\'s bill',
      say: 'Check versus Bills compares an order with the supplier\'s bill, item by item, and lists any differences to report to the supplier. The laws of this page, and this video, are on the Laws button.',
      run: async (h, page) => { await h.point(page.getByText('📜 Laws').first()) } },
  ],
}
