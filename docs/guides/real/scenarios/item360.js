// Item 360 guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'item360',
  url: '/item?tab=loss&view=item360',
  mock(p, m, q) {
    if (p === '/api/losses/summary') return S.items.map(i => ({
      item_id: i.id, item_name: i.name, cf_group: i.group, product_type: 'goods', soh: String(i.soh), sp: String(i.selling_price), cp: String(i.cost_price),
      units_per_pack: '1', converts_to_item_id: null, derived_from_item_id: null, count_interval: null, gmc_type: null, description: null, needs_review: false,
      lgAmt: 0, lgQty: 0, lossCount: 0, gainAmt: 0, wic: 0, gmc: 0, bl: 0, cnv: 0 }))
    if (p === '/api/items/search') {
      const s = (q.get('q') || '').toLowerCase()
      return S.items.filter(i => i.name.toLowerCase().includes(s) || i.group.toLowerCase().includes(s))
        .map(i => ({ id: i.id, name: i.name, group: i.group, soh: i.soh, selling_price: i.selling_price }))
    }
  },
  steps: [
    { caption: '<b>Item 360</b>: everything about one item',
      say: 'This is Item 360. Search any item, to see everything about it in one place: stock, prices, and its history.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Type the item name or group',
      say: 'Type part of the item name, or its group, in the search box.',
      run: async (h, page) => { const s = page.getByPlaceholder(/Item 360: search/); await h.tap(s); await h.type(s, 'mouse'); await h.wait(1200) } },

    { caption: '2. Tap the item',
      say: 'Each result shows the group, the stock on hand, and the selling price. Tap the one you want.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: /Wireless Mouse/ }).first()); await h.wait(2500) } },

    { caption: '3. Stock, prices and history',
      say: 'Here is the full detail: the stock on hand, the prices, and the loss and gain history. Owners can also edit the item here.',
      run: async (h, page) => { await page.mouse.wheel(0, 300); await h.wait(2500) } },

    { caption: '<b>← Back to results</b>',
      say: 'Tap Back to results to look up another item.',
      run: async (h, page) => { await page.mouse.wheel(0, -600); await h.wait(500); await h.tap(page.getByRole('button', { name: /Back to results/ })); await h.wait(1500) } },

    { caption: 'Law: find the <b>cause</b> in Item 360 first', lawRe: 'find the cause',
      say: 'Company law: when an item shows a loss, negative stock or a wrong price, open Item 360 and find the cause, a bill, a count, a sale or an edit, before changing anything.',
      run: async (h, page) => { await h.point(page.getByPlaceholder(/Item 360: search/)); await h.wait(1500) } },

    { caption: 'Change item details only to fix a <b>real mistake</b>', lawRe: 'real mistake|hide a loss',
      say: 'Item details are changed only to fix a real mistake, never to hide a loss or make a count match. Breaking a law costs penalty points, and the owner approves every sanction. The laws and this video are on the Laws button.',
      run: async (h, page) => { await h.point(page.getByText('📜 Laws').first()); await h.wait(1500) } },
  ],
}
