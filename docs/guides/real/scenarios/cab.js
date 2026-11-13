// CAB (Cash at Bank) guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
let bal = 41800
const rows = Array.from({ length: 14 }, (_, i) => {
  const d = S.dayAgo(13 - i), cc = 2200 + (i * 173) % 1800, bills = i % 3 === 0 ? 1200 : 0, exp = 60 + (i * 37) % 150
  const net = cc - bills - exp; bal += net
  const confirmed = i === 6 || i === 13
  return { entry_date: d, cash_counted: cc, grony_personal_cash_in: 0, debtors_cash_in: i % 5 === 0 ? 300 : 0, bills, expenses: exp, grony_personal_expenses: 0, daily_net: net, running_cash_at_bank: bal,
    cab_bank: confirmed ? Math.round(bal * 0.8) : null, cab_momo: confirmed ? Math.round(bal * 0.12) : null, cab_physical: confirmed ? bal - Math.round(bal * 0.8) - Math.round(bal * 0.12) : null,
    cab_total: confirmed ? bal : null, deficit: confirmed ? 0 : null }
})
module.exports = {
  key: 'cab',
  nav: '🏦 CAB',
  url: '/item?tab=loss&view=cab',
  mock(p, m, q, body) {
    if (p === '/api/cash-at-bank' && m === 'GET') return rows
    if (p === '/api/cash-at-bank' && m === 'POST') {
      const r = rows.find(x => x.entry_date.slice(0, 10) === body.entry_date.slice(0, 10)) || rows[rows.length - 1]
      r.cab_bank = body.cab_bank; r.cab_momo = body.cab_momo; r.cab_physical = body.cab_physical; r.cab_total = body.cab_bank + body.cab_momo + body.cab_physical; r.deficit = r.running_cash_at_bank - r.cab_total
      return { ok: true }
    }
  },
  steps: [
    { caption: '<b>CAB</b>: cash at bank, week by week',
      say: 'This is C A B, cash at bank. It checks, week by week, that the money we should have matches the money we really have.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Each day: cash in, bills, expenses, <b>running balance</b>',
      say: 'Each day shows the cash counted, the bills and expenses paid, and the running balance, which is the money we should have.',
      run: async (h, page) => { await h.wait(3500) } },

    { caption: 'End of the week: tap <b>+ New CAB Confirm</b>',
      say: 'At the end of the week, tap plus New C A B Confirm.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: /New CAB Confirm/ })); await h.wait(1200) } },

    { caption: 'Type the <b>real</b> bank, MoMo and cash amounts',
      say: 'Check the bank balance and the MoMo balance, count the physical cash, and type the real amounts.',
      run: async (h, page) => {
        const n = page.locator('input[placeholder="0"]')
        for (const [i, v] of [[0, '32000'], [1, '4900'], [2, '5100']]) { const el = n.nth(i); await h.tap(el); await h.type(el, v) }
      } },

    { caption: 'Tap <b>Verify</b>: the difference shows',
      say: 'Then confirm it. The difference shows anything that does not match, and weeks not yet confirmed still need checking.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: /Verify|Save|Confirm/ }).first()); await h.wait(2500) } },

    { caption: 'The laws and this video: <b>📜 Laws</b>',
      say: 'The laws of this page, and this video, are on the Laws button.',
      run: async (h, page) => { await h.point(page.getByText('📜 Laws').first()) } },
  ],
}
