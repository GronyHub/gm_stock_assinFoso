// Live Sale guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'sale',
  url: '/item?tab=loss&mode=sale',
  mock(p, m, q, body) {
    // The demo staff member is already clocked in for the day.
    if (p === '/api/staff-times/today') return { today: [], mine: { actual_in: new Date(Date.now() - 4 * 3600000).toISOString() }, recent: [], opener: null, openerConfirmed: null, closer: null }
    if (p === '/api/sales/live-tap' && m === 'POST') {
      const it = S.items.find(i => i.id === Number(body.itemId)) || S.items[0]
      const tap = { id: 7100, item_id: it.id, item_name: it.name, price: Number(body.customPrice ?? it.selling_price), staff_name: 'demo', tapped_at: new Date().toISOString(), undone: false, receipt_id: 9001, quantity: Number(body.quantity) || 1, soh: it.soh - 1, is_gmc: false, customer_id_code: null, buyer_name: body.customerLabel || null }
      return { tap, whatsappUrl: null, buyerId: null, lineQuantity: tap.quantity, lineTotal: tap.price * tap.quantity }
    }
  },
  steps: [
    { caption: '<b>Live Sale</b>: record every sale as it happens',
      say: 'This is Live Sale. Every sale in the shop is recorded here, the moment it happens. Each item has its own card.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Find the item: type its name in <b>Search</b>',
      say: 'First, find the item. Type its name in Search, and the cards narrow down. You can also use All and Groups.',
      run: async (h, page) => {
        const box = page.getByPlaceholder('Search item…'); await h.tap(box); await h.type(box, 'mouse'); await h.wait(800)
      } },

    { caption: '2. Check the <b>quantity</b> and the <b>price</b>',
      say: 'Check the quantity and the price on the card. Change them if the customer bought more than one, or agreed a different price.',
      run: async (h, page) => {
        const qty = page.getByPlaceholder('Qty').first(); await h.tap(qty); await qty.fill(''); await h.type(qty, '2')
        await h.point(page.locator('input[type=number]').nth(1))
      } },

    { caption: '3. <b>Who</b> is it for? A GM number, phone, name or label',
      say: "Next, say who the sale is for. Type the customer's G M number, phone number or name. If you don't know them, type a short label, such as man in blue shirt.",
      run: async (h, page) => {
        const who = page.getByPlaceholder('Who? (required)').first(); await h.tap(who); await h.type(who, 'Man in blue shirt')
      } },

    { caption: '4. Tap the red <b>✓</b> to record the sale',
      say: 'Then tap the red tick to record the sale. It goes straight into the Sales Log.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: /Record sale for Wireless Mouse/ })); await h.wait(1500) } },

    { caption: 'New phone number? The customer form opens',
      say: 'If you type a phone number we do not know, the customer form opens, so you can register them as you sell.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Several items, one customer: <b>MI</b>',
      say: 'When one customer buys several items, tap M I. Add each item to the basket, pick the customer, and issue one receipt for everything.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'MI', exact: true })); await h.wait(2000) } },

    { caption: '<b>WIC</b> = a sale. <b>GMC</b> = shop use, not a sale',
      say: 'Keep the switch on W I C for a sale to a customer. G M C is only for things the shop uses itself, and it is not a sale.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: 'WIC', exact: true })) } },

    { caption: 'Wrong sale? Undo it in the <b>Sales Log</b>',
      say: 'If you record a sale by mistake, undo it in the Sales Log. Never tap again to correct it, because that records a second sale. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
