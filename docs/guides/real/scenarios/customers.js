// Customers guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'customers',
  url: '/item?tab=loss&view=customers',
  mock(p, m, q, body) {
    if (p === '/api/customers' && m === 'GET') return S.customers
    if (p === '/api/receipts' && m === 'GET') return [
      { id: 801, invoice_number: 'RCT-261107-04121', invoice_date: S.dayAgo(0), total: '140.00', lines: [{ item: 'A4 SHEETS MAMBO', qty: 2 }] },
      { id: 802, invoice_number: 'RCT-261030-03877', invoice_date: S.dayAgo(8), total: '75.00', lines: [{ item: 'Picture Printing (A4)', qty: 5 }] },
      { id: 803, invoice_number: 'RCT-261012-03102', invoice_date: S.dayAgo(26), total: '60.00', lines: [{ item: 'Passport Picture', qty: 3 }] },
    ]
  },
  steps: [
    { caption: '<b>Customers</b>: everyone who buys from us',
      say: 'This is Customers, everyone who buys from us, each with a G M number.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'New customers are registered while you <b>sell</b>',
      say: 'New customers are registered while you sell. In Live Sale, type a new phone number in the Who box, and the customer form opens. Fill it in and save.',
      run: async (h, page) => { await h.wait(3000) } },

    { caption: 'Find a customer: <b>search</b> by name, phone or GM number',
      say: 'To find a customer, search by name, phone number or G M number.',
      run: async (h, page) => {
        const s = page.getByPlaceholder(/Search .* customers/); await h.tap(s); await h.type(s, 'ama'); await h.wait(1500); await s.fill(''); await h.wait(600)
      } },

    { caption: '<b>Flags</b>: customers missing a location, contact or email',
      say: 'Use Flags to find customers who are missing a location, a contact number or an email, so you can complete them.',
      run: async (h, page) => {
        const f = page.locator('select:has(option:text-matches("Flags"))'); await h.pick(f, { index: 1 }); await h.wait(1800); await h.pick(f, ''); await h.wait(600)
      } },

    { caption: 'Tap a customer to open their <b>record</b>',
      say: 'Tap a customer to open their record. Here you can correct their phone number, location and other details, then tap Save Changes.',
      run: async (h, page) => { await h.tap(page.getByText('Ama Serwaa').first()); await h.wait(2500) } },

    { caption: '<b>Cancel</b> or <b>Save</b> to see their receipts',
      say: 'When you are done, tap Cancel or Save Changes. The customer\'s summary shows how much they have bought, and all their receipts, newest first.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'Cancel' }).first()); await h.wait(2000) } },

    { caption: '<b>View / print</b> any receipt',
      say: 'Tap View or print beside any receipt to see it again, or print it.',
      run: async (h, page) => { await h.point(page.getByRole('link', { name: 'View / print' }).first()) } },

    { caption: 'Play this guide any time with <b>▶ Guide</b>',
      say: 'That is Customers. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
