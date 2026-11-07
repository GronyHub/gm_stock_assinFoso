// Counts guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'counts',
  url: '/item?tab=loss&view=counts',
  mock(p, m, q, body) {
    if (p === '/api/stock/counts' && m === 'GET') return S.counts
    if (p === '/api/stock/count' && m === 'POST') {
      const it = S.items.find(i => i.id === Number(body.itemId)) || S.items[0]
      S.counts.unshift({ id: 610, item_id: it.id, item_name: it.name, count_date: S.today, quantity_counted: String(body.qty), notes: body.notes || null, counted_by: 'demo', source: 'manual', cf_group: it.group })
      return { ok: true }
    }
  },
  steps: [
    { caption: '<b>Counts</b>: checking the stock on the shelves',
      say: 'This is Counts, where stock counts are recorded, to check that what is on the shelf matches the records. Every count is listed, newest first.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Tap <b>+ Manual Count</b>',
      say: 'To record a count, tap plus Manual Count.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: '+ Manual Count' })); await h.wait(1000) } },

    { caption: '2. Search the item and tap it',
      say: 'Search for the item you counted, and tap it.',
      run: async (h, page) => {
        const s = page.getByPlaceholder('Search item to count…'); await h.tap(s); await h.type(s, 'mouse'); await h.wait(800)
        await h.tap(page.getByRole('button', { name: /Wireless Mouse/ }).first()); await h.wait(600)
      } },

    { caption: '3. Count them on the shelf. Type the <b>number</b>',
      say: 'Count the item on the shelf, and type the number you counted. Add a note if there is something to explain.',
      run: async (h, page) => { const q = page.getByPlaceholder('Qty counted'); await h.tap(q); await h.type(q, '8'); await h.wait(500) } },

    { caption: '4. Tap <b>Save</b>',
      say: 'Then tap Save. If your count is lower than the records expect, the app will ask why, so always give the real reason.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'Save', exact: true })); await h.wait(2500) } },

    { caption: '<b>History</b>: every count ever made',
      say: 'History lists every count ever made, and who made it.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: 'History' })) } },

    { caption: '<b>Analytics</b>: losses and gains over time',
      say: 'Analytics shows losses and gains over time. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
