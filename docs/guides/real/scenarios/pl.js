// P&L guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
const daily = [3820, 2740, 3105, 1990, 2860, 3410, 2255, 3650, 2480, 2975, 3180, 2610].map((cc, i) => {
  const bills = i % 3 === 0 ? 1450 : i % 3 === 1 ? 320 : 0, expenses = [120, 60, 0, 90, 75, 200, 0, 45, 130, 60, 85, 0][i], dailyLoss = [0, 15, 0, 0, 30, 0, 0, 12, 0, 0, 0, 25][i]
  return { date: S.dayAgo(i + 1), cashCounted: cc, bills, expenses, cashOut: bills + expenses, dailyLoss, profit: cc - bills - expenses - dailyLoss }
})
const sum = k => daily.reduce((s, d) => s + d[k], 0)
module.exports = {
  key: 'pl',
  url: '/item?tab=loss&view=pl',
  mock(p, m, q, body) {
    if (p === '/api/analysis/profit-loss') return {
      totals: { cashCounted: 96400, expenses: 9850, bills: 41200, dailyLoss: 640, profit: 44710 },
      monthly: [
        { month: '2026-11', cashCounted: 18900, expenses: 1200, bills: 7600, dailyLoss: 120, profit: 9980 },
        { month: '2026-10', cashCounted: 41200, expenses: 4100, bills: 18200, dailyLoss: 310, profit: 18590 },
        { month: '2026-09', cashCounted: 36300, expenses: 4550, bills: 15400, dailyLoss: 210, profit: 16140 },
      ],
      daily,
    }
  },
  steps: [
    { caption: '<b>Profit &amp; Loss</b>: did the shop make money?',
      say: 'This is Profit and Loss. It shows whether the shop made money. Only the owner and Joe can open it.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'At the top: <b>totals</b> for all the time',
      say: 'At the top are the totals: the cash counted, the bills and expenses paid, the stock losses, and the profit.',
      run: async (h, page) => { await h.wait(3000) } },

    { caption: 'Then each <b>month</b>',
      say: 'Below them, each month is shown the same way, so you can see which months did well.',
      run: async (h, page) => { await page.mouse.wheel(0, 380); await h.wait(3000) } },

    { caption: 'And each <b>day</b>: cash, bills, expenses, losses, <b>P/L</b>',
      say: 'Then each day. It shows the cash counted, the bills and expenses paid, the total cash out, and the day\'s stock losses. The last column is the profit or loss for the day.',
      run: async (h, page) => { await page.mouse.wheel(0, 600); await h.wait(3500) } },

    { caption: 'Play this guide any time with <b>▶ Guide</b>',
      say: 'Enter the cash counted every day, so these figures are right. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { await page.mouse.wheel(0, -2000); await h.wait(600); await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
