// Expenses guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'expenses',
  url: '/item?tab=loss&mode=expenses',
  mock(p, m, q, body) {
    if (p === '/api/expenses' && m === 'GET') return S.expenses
    if (p === '/api/expenses' && m === 'POST') {
      const e = { ...S.expenses[0], id: 506, expense_date: body.date || S.today, expense_account: body.account || body.category || 'Transport', description: body.description, amount: String(body.amount) }
      S.expenses.unshift(e); return { id: 506 }
    }
    if (p === '/api/properties') return []
  },
  steps: [
    { caption: '<b>Expenses</b>: money spent running the shop',
      say: 'This is Expenses, for money spent on running the shop, such as transport, repairs, electricity and rent.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Tap <b>+ New</b>',
      say: 'To record an expense, tap plus New.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: '+ New', exact: true })); await h.wait(1200) } },

    { caption: '2. Say what it was for, and the <b>category</b>',
      say: 'Check the date. Describe what the money was spent on, and pick or type a category, such as transport or rent.',
      run: async (h, page) => {
        const d = page.getByPlaceholder('What was this expense for?'); await h.tap(d); await h.type(d, 'Fuel for the generator')
        const c = page.getByPlaceholder('e.g. Rent, or type your own'); await h.tap(c); await c.press('Control+a'); await h.type(c, 'Fuel')
      } },

    { caption: '3. Type the <b>amount</b>, then <b>Save Expense</b>',
      say: 'Type the amount, and tap Save Expense.',
      run: async (h, page) => {
        const a = page.getByPlaceholder('0.00'); await h.tap(a); await h.type(a, '75')
        await h.tap(page.getByRole('button', { name: 'Save Expense' })); await h.wait(2500)
      } },

    { caption: 'Find an expense: filter by <b>account</b>',
      say: 'To find an expense, filter by account, such as Transport, or by type.',
      run: async (h, page) => {
        const acc = page.locator('select:has(option:text("All Accounts"))'); await h.pick(acc, { index: 1 }); await h.wait(1200); await h.pick(acc, ''); await h.wait(500)
      } },

    { caption: 'Or <b>search</b> by words',
      say: 'Or search by words in the description.',
      run: async (h, page) => { const s = page.getByPlaceholder('Search…').last(); await h.tap(s); await h.type(s, 'rent'); await h.wait(1500); await s.fill(''); await h.wait(500) } },

    { caption: '<b>Filter</b>: other views, history and analytics',
      say: 'The Filter menu opens other views, such as history and analytics, and the Flags page shows expenses that need fixing. The laws of this page, and this video, are on the Laws button.',
      run: async (h, page) => { await h.point(page.getByText('📜 Laws').first()) } },
  ],
}
