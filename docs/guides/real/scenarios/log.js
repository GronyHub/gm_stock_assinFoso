// Sales Log guide: the real page, driven step by step (see ../record.js).
module.exports = {
  key: 'log',
  url: '/item?tab=loss&mode=log',
  titles: { log: 'Sales Log' },
  steps: [
    { caption: '<b>Sales Log</b>: every sale, day by day',
      say: 'This is the Sales Log. It lists every sale, day by day, newest first. The green row is today.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'At closing: tap <b>+ CC</b> and type the cash you counted',
      say: 'At closing, count the cash. Tap plus C C, type the amount, and press Enter.',
      run: async (h, page) => {
        await h.tap(page.getByRole('button', { name: '+ CC' }).first())
        await h.type(page.locator('input[type=number]').first(), '2050')
        await page.keyboard.press('Enter'); await h.wait(1200)
      } },

    { caption: '<b>WNW</b> = cash counted minus sales',
      say: 'W N W shows the difference between the cash and the sales written down. Orange means there is more cash than sales recorded. Red means the cash is short.',
      run: async (h, page) => { await h.point(page.getByText(/^WNW/).first()) } },

    { caption: 'Each sale: customer, price, cost, profit',
      say: 'Under it, each sale shows the customer, the price, the cost and the profit. A tick in W A means the WhatsApp message was sent.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Tap a receipt number to view or reprint it',
      say: 'When a sale is on a receipt, its number shows under the customer. Tap it to view or reprint the receipt.',
      run: async (h, page) => { await h.point(page.locator('a[title^="Receipt RCT"]').first()) } },

    { caption: 'Wrong sale? Tap <b>undo</b>',
      say: 'To cancel a wrong sale, tap the undo arrow. The sale turns red and is marked cancelled.',
      run: async (h, page) => { await h.tap(page.locator('button[title="Undo"]').first()); await h.wait(1500) } },

    { caption: 'Older sales: pick a <b>Period</b>',
      say: 'To see older sales, tap Period and pick a year, then a month. The Sales Log goes back to twenty twenty three.',
      run: async (h, page) => {
        await h.pick(page.locator('select[title^="Period"]'), '2024')
        await h.pick(page.locator('select:has(option:text("Whole year"))'), '5')
        await h.wait(1500)
      } },

    { caption: 'Grey <b>REC</b> rows are older records (view only)',
      say: 'Older records show in grey, marked R E C. They can be viewed, but not changed. A paperclip means a photo of that day\'s form is attached. Tap it to see it.',
      run: async (h, page) => {
        const clip = page.getByRole('button', { name: /📎/ }).first()
        await h.tap(clip); await h.wait(3000)
        await clip.click(); await h.wait(500)
      } },

    { caption: 'Back to the last 90 days',
      say: 'To come back to recent sales, pick Last ninety days.',
      run: async (h, page) => { await h.pick(page.locator('select[title^="Period"]'), ''); await h.wait(1200) } },

    { caption: '<b>Receipt…</b>, <b>+ Past sale</b> and the chart',
      say: 'On the bar, Receipt makes one receipt from sales you tick. Plus Past sale records a sale from an earlier day. And the chart button opens analytics, with totals for every day and month.',
      run: async (h, page) => {
        await h.point(page.getByRole('button', { name: 'Receipt…' }))
        await h.point(page.getByRole('button', { name: '+ Past sale' }))
      } },

    { caption: 'Play this guide any time with <b>▶ Guide</b>',
      say: 'That is the Sales Log. You can play this guide again any time with the Guide button.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: '▶ Guide' })) } },
  ],
}
