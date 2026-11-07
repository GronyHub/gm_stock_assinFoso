// Vendors guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'vendors',
  url: '/item?tab=loss&view=vendors',
  mock(p, m, q, body) {
    if (p === '/api/vendors' && m === 'GET') return S.vendors
    if (p === '/api/vendors' && m === 'POST') {
      const v = { ...S.vendors[0], id: 44, display_name: body.display_name || body.name, company_name: body.company_name || null, phone: body.phone || null, email: body.email || null, location: null, bill_count: 0, bill_total: '0', outstanding: '0', payment_count: 0, amount_paid: '0' }
      S.vendors.unshift(v); return v
    }
    if (/^\/api\/vendors\/\d+/.test(p)) return { bills: [], payments: [] }
  },
  steps: [
    { caption: '<b>Vendors</b>: the suppliers we buy from',
      say: 'This is Vendors, the list of suppliers we buy from. It shows what we have billed with each, what we have paid, and what is still outstanding.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Tap <b>+ New Vendor</b>',
      say: 'To add a supplier, tap plus New Vendor.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: '+ New Vendor' })); await h.wait(1000) } },

    { caption: '2. Type their <b>name</b> and <b>phone</b>',
      say: 'Type the supplier\'s name and their phone number. The company, email and notes are optional.',
      run: async (h, page) => {
        const n = page.getByPlaceholder('e.g. Kwame Mensah'); await h.tap(n); await h.type(n, 'Yaw Stationery Wholesale')
        const ph = page.locator('label:text-is("Phone") + input').first(); await h.tap(ph); await h.type(ph, '0551234567')
      } },

    { caption: '3. Tap <b>Save Vendor</b>',
      say: 'Then tap Save Vendor.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'Save Vendor' })); await h.wait(2000) } },

    { caption: 'Tap a vendor to see their bills and payments',
      say: 'Tap any vendor to see their bills and payments, and how much is still outstanding.',
      run: async (h, page) => { await h.tap(page.getByText('Kwame Paper Supplies').first()); await h.wait(2500) } },

    { caption: '<b>🚩 No contact</b>: vendors to complete',
      say: 'The red flag button lists vendors with no contact number or location, so you can complete them. Tap it again to see everyone.',
      run: async (h, page) => {
        const f = page.getByRole('button', { name: /No contact/ }); await h.tap(f); await h.wait(1800); await h.tap(f); await h.wait(600)
      } },

    { caption: 'Or <b>search</b> by name',
      say: 'Or search for a vendor by name. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { const s = page.getByPlaceholder(/Search .* vendors/); await h.tap(s); await h.type(s, 'toner'); await h.wait(1500); await s.fill(''); await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
