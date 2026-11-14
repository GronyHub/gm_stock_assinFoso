// Live guide: the real page, driven step by step (see ../record.js). Narration says "Live" (never "Live Sale" or "Items").
// Flags are not on Live any more (they are on the Flags page, for the manager), laws are not signed, and there are no law quizzes.
const S = require('../sample')

// A native dropdown does not show in a screen recording, so "open" it as a list showing the real options (what the page
// itself holds), and put it back afterwards.
const openList = async (page, sel) => {
  await sel.evaluate(el => {
    el.__oldStyle = el.getAttribute('style') || ''
    el.style.cssText += ';position:fixed;left:80px;right:8px;top:66px;height:auto;z-index:99990;background:#fff;color:#111;font-size:15px;border:3px solid #dc2626;border-radius:10px'
    el.size = el.options.length
  })
}
const closeList = async sel => { await sel.evaluate(el => { el.removeAttribute('size'); el.setAttribute('style', el.__oldStyle || '') }) }

// Company Laws > Live, as the real tile shows it: the live staff laws this video reads out (codes are given by the app; they
// are not spoken). Texts as in the brief of 2026-11-13.
const law = (id, sub, text, points = 1) => ({ id, text, scope_key: 'Stock & records', category: 'Stock & records', subcategory: sub, code: 'LS-' + id, law_type: 'standing', days: null, law_time: null, frequency: null, minutes: null, dos: null, donts: null, status: 'approved', tile_id: null, proof: 'tick', points, carousel_message: null, display_in_carousel: false, carousel_type: 'law', carousel_order: null, created_at: S.dayAgo(30) + 'T09:00:00Z' })
const LAWS = [
  law(1, 'Recording', 'All sales, bills and expenses are recorded in the GM app. Written work forms are no longer used.'),
  law(2, 'Recording', "Every walk-in sale goes in Live with WIC on (GMC only for the shop's own use). A customer buying several items is sold through MI: one basket, one receipt."),
  law(3, 'Recording', 'Record shop use as GMC and a customer sale as WIC.'),
  law(4, 'Recording', 'Give the customer a receipt for every sale.'),
  law(5, 'Recording', 'Never force a sale the app refuses: tell Joe.'),
  law(6, 'Recording', 'Enter every sale in the app: no sale is ever made without an entry.', 20),
  law(7, 'Recording', 'Never steal or pilfer money, goods or stock belonging to the shop.', 20),
  law(8, 'Recording', 'Before uploading the attachments, mark those you have entered.'),
  law(9, 'Item list', 'Always have a printed list of items, their SP and Count.'),
  law(10, 'Item list', 'Every sellable item at the shop must be on the item list.'),
  law(11, 'Item list', 'Weekly: item groups checked, every good in the right group; leave no item in the wrong group or no group.'),
  law(12, 'Prices', 'Monthly: the price list is current and every staff member has it; never sell at an old price after the list is updated.'),
  law(13, 'Understanding', 'Understand what Live is for'),
  law(14, 'Understanding', 'Know the app abbreviations'),
  law(15, 'Understanding', 'Know how to find, price and record a sale'),
]
module.exports = {
  key: 'sale',
  url: '/item?tab=loss&mode=sale',
  mock(p, m, q, body) {
    if (p === '/api/page-laws' && m === 'GET') return LAWS
    if (p === '/api/law-signatures') return {}
    if (p === '/api/sales/live-tap' && m === 'POST') {
      const it = S.items.find(i => i.id === Number(body.itemId)) || S.items[0]
      const tap = { id: 7100, item_id: it.id, item_name: it.name, price: Number(body.customPrice ?? it.selling_price), staff_name: 'demo', tapped_at: new Date().toISOString(), undone: false, receipt_id: 9001, quantity: Number(body.quantity) || 1, soh: it.soh - 1, is_gmc: false, customer_id_code: null, buyer_name: body.customerLabel || null }
      return { tap, whatsappUrl: null, buyerId: null, lineQuantity: tap.quantity, lineTotal: tap.price * tap.quantity }
    }
  },
  steps: [
    { caption: '<b>Live</b>: find the item, check <b>quantity</b> and <b>price</b>',
      say: 'This is Live, where every sale is recorded as it happens. You must be clocked in to record a sale. Find the item in Search, then check the quantity and the price.',
      run: async (h, page) => {
        await h.wait(600)
        const box = page.getByPlaceholder('Search item…'); await h.tap(box); await h.type(box, 'mouse')
        const qty = page.getByPlaceholder('Qty').first(); await h.tap(qty); await qty.fill(''); await h.type(qty, '2')
        await h.point(page.locator('input[type=number]').nth(1))
      } },

    { caption: '<b>Who</b> is it for? Then tap the red <b>✓</b>',
      say: 'Say who it is for: a G M number, a phone, a name, or a short label. Tap the red tick, and the sale goes into the Sales Log.',
      run: async (h, page) => {
        const who = page.getByPlaceholder('Who? (required)').first(); await h.tap(who); await h.type(who, 'Man in blue shirt')
        await h.tap(page.getByRole('button', { name: /Record sale for Wireless Mouse/ })); await h.wait(1200)
      } },

    { caption: 'Left sidebar: you and the team, <b>points</b> and <b>today\'s sales</b>',
      say: 'At the top of the left sidebar: your row, then the team, each with penalty points and today\'s sales.',
      run: async (h, page) => {
        await page.locator('input[placeholder="Search item…"]').fill(''); await h.wait(300)
        await h.point(page.locator('button[title^="You are signed in"]').first())
        await h.point(page.locator('button[data-keep-embed]').nth(2))
      } },

    { caption: 'Know the words: <b>SOH, SP, CP, WIC, GMC, MI, CAB</b>', lawRe: 'abbreviation|what Live is for|find, price and record',
      say: 'Know what Live is for, how to record a sale, and the app words. S O H is stock on hand. S P, selling price. C P, cost price. W I C, walk-in customer. G M C, Grony Multimedia as customer. M I, several items in one basket. And C A B, cash at bank. One point each.',
      run: async (h, page) => {
        await h.point(page.getByText(/ACP/).first())
        await h.point(page.getByRole('button', { name: 'WIC', exact: true }))
        await h.point(page.getByRole('button', { name: 'MI', exact: true }))
      } },

    { caption: 'Walk-in sale with <b>WIC</b> on. Several items: <b>MI</b>', lawRe: 'walk-in sale|several items|shop use',
      say: "Company law: every walk-in sale goes in Live with W I C on. G M C is only for the shop's own use. A customer buying several items is sold through M I: one basket, one receipt. Record shop use as G M C, and a customer sale as W I C. One point each.",
      run: async (h, page) => {
        await h.tap(page.getByRole('button', { name: 'MI', exact: true })); await h.wait(3000)   // the basket opens: add items, pick the customer, one receipt
        await h.tap(page.getByRole('button', { name: 'MI', exact: true }))   // and closes again
      } },

    { caption: 'A <b>receipt</b> for every sale. Never force a refused sale', lawRe: 'receipt for every sale|force a sale',
      say: 'Give the customer a receipt for every sale. Never force a sale the app refuses: tell Joe. One point each.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: /Record sale for/ }).first()); await h.wait(800) } },

    { caption: 'Every sale in the app. <b>Dismissal</b>', lawRe: 'without an entry|steal|pilfer|GM app',
      say: 'Enter every sale in the app: no sale is ever made without an entry. That is dismissal. Never steal or pilfer money, goods or stock belonging to the shop. That is dismissal too. All sales, bills and expenses are recorded in the G M app. Written work forms are no longer used. One point.',
      run: async (h, page) => { await h.point(page.locator('a[title^="Sales Log"], button:has-text("Sales Log")').first()); await h.wait(1500) } },

    { caption: 'Attachments: <b>mark</b> what you have entered first', lawRe: 'attachments',
      say: 'Before uploading the attachments, mark those you have entered. One point.',
      run: async (h, page) => { await h.point(page.getByText('📷').last()); await h.wait(600) } },

    { caption: 'A <b>printed item list</b>: every item, its SP and Count', lawRe: 'printed list|on the item list',
      say: 'Always have a printed list of items, with their S P and count. Every sellable item at the shop must be on the item list. One point each.',
      run: async (h, page) => { await page.mouse.wheel(0, 250); await h.wait(1500); await page.mouse.wheel(0, -250); await h.wait(800) } },

    { caption: 'Weekly: every good in the <b>right group</b>', lawRe: 'item groups|right group',
      say: 'Weekly: item groups are checked, and every good is in the right group. Leave no item in the wrong group, or in no group. One point.',
      run: async (h, page) => {
        const g = page.locator('select').filter({ hasText: 'Groups' }).first(); await h.point(g); await openList(page, g); await h.wait(2500); await closeList(g)
      } },

    { caption: 'Monthly: the <b>price list</b> is current', lawRe: 'price list|old price',
      say: 'Monthly: the price list is current, and every staff member has it. Never sell at an old price after the list is updated. One point.',
      run: async (h, page) => { await h.point(page.locator('input[type=number]').nth(1)); await h.point(page.locator('input[type=number]').nth(3)) } },

    { caption: 'Flags: on the <b>Flags</b> page. Tasks: <b>Waiting for team</b>', lawRe: 'Flags page',
      say: 'Flags are on the Flags page, and the manager clears them. Your tasks are in Waiting for team, and It\'s time for pops up when one falls due.',
      run: async (h, page) => { await h.point(page.getByText('Waiting for team').first()); await h.wait(1200) } },

    { caption: 'Everything for this page: <b>📜 Laws</b>',
      say: 'The laws, and this video with its transcript, are on the Laws button.',
      run: async (h, page) => { await h.tap(page.getByText('📜 Laws').first()); await h.wait(3500)
        await page.locator('video').first().scrollIntoViewIfNeeded().catch(() => {}); await h.wait(1500) } },

    { caption: 'Penalty points: <b>20</b> = 3 days, <b>30</b> = 1 week, <b>50</b> = dismissal',
      say: 'The laws are statutory. Breaking one costs penalty points: twenty is a three day suspension, thirty is one week, and fifty is dismissal. Not entering a sale, and stealing, are dismissal with no points. The owner approves every sanction. Each day you get one law question; a wrong answer offers the video.',
      run: async (h, page) => {
        const code = page.getByText(/^LS-2\b/).first()
        if (await code.count()) { await code.evaluate(el => el.scrollIntoView({ block: 'center' })); await h.wait(1200); await h.point(code) }
        else { await page.mouse.move(250, 400); await page.mouse.wheel(0, 500); await h.wait(1500) }
        await h.wait(2500)
      } },
  ],
}
