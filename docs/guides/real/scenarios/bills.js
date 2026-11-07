// Bills guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'bills',
  url: '/item?tab=loss&mode=bills',
  mock(p, m, q, body) {
    if (p === '/api/bills' && m === 'GET') return S.bills
    if (p === '/api/bills' && m === 'POST') {
      const l = body.lines[0], id = 304
      const total = body.lines.reduce((s, x) => s + x.total, 0)
      S.bills.unshift({ id, bill_number: 'B-1046', bill_date: body.date, vendor_name: l.vendorName, total: String(total), status: 'paid', entered_by: 'demo', attachments: [] })
      body.lines.forEach((x, i) => S.billLines.push({ id: 90 + i, bill_id: id, item_id: x.itemId, item_name: x.itemName, quantity: String(x.qty), unit_price: String(x.price), item_total: String(x.total), usage_unit: null, unresolved: false }))
      return { id }
    }
    if (p === '/api/bills/all-lines') return S.billLines
    if (p === '/api/bills/expenses') return []
    if (p === '/api/vendors') return S.vendors
    if (p === '/api/items/search') return S.items.filter(i => i.name.toLowerCase().includes((q.get('q') || '').toLowerCase())).map(i => ({ id: i.id, name: i.name, group: i.group, soh: i.soh }))
  },
  steps: [
    { caption: '<b>Bills</b>: everything the shop buys',
      say: 'This is Bills. Every purchase the shop makes, from stock to supplies, is recorded here as a bill. The bills are listed with their items.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Tap <b>+ New Bill</b>',
      say: 'To record a bill, tap plus New Bill.',
      run: async (h, page) => { await h.tap(page.locator('label:has-text("+ New Bill")').first()); await h.wait(1200) } },

    { caption: '2. Pick the date, then search for the item you bought',
      say: 'Check the date, then search for an item you bought, and tap it in the results.',
      run: async (h, page) => {
        const box = page.getByPlaceholder('Search item…').last(); await h.tap(box); await h.type(box, 'mouse'); await h.wait(800)
        await h.tap(page.getByRole('button', { name: /Wireless Mouse/ })); await h.wait(600)
      } },

    { caption: '3. Type the <b>quantity</b>, the <b>cost price</b> and the <b>vendor</b>',
      say: 'Type the quantity you bought, the cost price for each one, and the name of the vendor you bought it from.',
      run: async (h, page) => {
        const nums = page.locator('input[type=number]')
        const qty = nums.nth(0), cost = nums.nth(1)
        await h.tap(qty); await qty.press('Control+a'); await h.type(qty, '6')
        await h.tap(cost); await cost.press('Control+a'); await h.type(cost, '40')
        const v = page.getByPlaceholder('Vendor name'); await h.tap(v); await h.type(v, 'Sika Computer Parts'); await h.wait(500)
      } },

    { caption: '4. Tap <b>Save Bill</b>',
      say: 'Add every item on the bill the same way. When you are done, tap Save Bill. The stock of those items goes up.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'Save Bill' })); await h.wait(3000) } },

    { caption: 'Find a bill: filter by <b>vendor</b>, <b>month</b> and <b>year</b>',
      say: 'To find a bill, filter by vendor, month and year at the top.',
      run: async (h, page) => {
        await h.pick(page.locator('select:has(option:text("All Vendors"))'), { label: 'Accra Toner Depot' }); await h.wait(1200)
        await h.pick(page.locator('select:has(option:text("All Vendors"))'), ''); await h.wait(800)
      } },

    { caption: '<b>Bars Only</b> shows just the bill totals',
      say: 'Bars Only shows just the bill totals, without the items. History lists every change made to bills.',
      run: async (h, page) => {
        await h.tap(page.locator('label:has-text("Bars Only")').first()); await h.wait(1800)
        await h.tap(page.locator('label:has-text("All")').first()); await h.wait(800)
      } },

    { caption: 'Keep every bill complete',
      say: 'Keep every bill complete: a vendor, an item list, its receipt attached, and its related expense. The flags show any bill that is missing one of these, so it can be fixed. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
