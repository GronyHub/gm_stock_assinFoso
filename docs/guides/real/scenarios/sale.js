// Live Sale guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')

// A native dropdown does not show in a screen recording, so "open" it as a list showing the real options (what the page
// itself holds), and put it back afterwards.
const openList = async (page, sel) => {
  await sel.evaluate(el => {
    el.__oldStyle = el.getAttribute('style') || ''
    el.style.cssText += ';position:fixed;left:8px;right:8px;top:66px;height:auto;z-index:99990;background:#fff;color:#111;font-size:15px;border:3px solid #dc2626;border-radius:10px'
    el.size = el.options.length
  })
}
const closeList = async sel => { await sel.evaluate(el => { el.removeAttribute('size'); el.setAttribute('style', el.__oldStyle || '') }) }
const flagsSel = page => page.locator('select').filter({ hasText: 'Flags' }).first()
const goto = async (page, path) => { await page.goto(new URL(path, page.url()).href + '&sidebarHidden=1', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500) }

// Company Laws > Items / Live Sale, as the real tile shows it: the laws this video reads out, with their codes (the real codes
// are given by the app the first time the page loads). Texts are the same as lib/lawDraftsMore.ts and lib/pageLaws.ts.
const law = (id, sub, text, o = {}) => ({ id, text, scope_key: 'Stock & records', category: 'Stock & records', subcategory: sub, code: 'LS-' + id, law_type: 'standing', days: null, law_time: null, frequency: null, minutes: null, dos: null, donts: null, status: 'approved', tile_id: null, proof: 'tick', points: 1, carousel_message: null, display_in_carousel: false, carousel_type: 'law', carousel_order: null, created_at: S.dayAgo(30) + 'T09:00:00Z', ...o })
let onLawsPage = false
const LAWS = [
  law(1, 'Item list', 'Item groups checked: every good is in the right group.', { law_type: 'recurring', frequency: 'weekly', days: 'wed', law_time: '11:00', minutes: 10 }),
  law(2, 'Prices', 'The price list is current and every staff member has it.', { law_type: 'recurring', frequency: 'monthly', law_time: '11:30', minutes: 10 }),
  law(3, 'Recording', "Every walk-in sale goes in Live Sale with WIC on (GMC only for the shop's own use). A customer buying several items is sold through MI: one basket, one receipt.", { law_type: 'app' }),
  law(4, 'Recording', 'Past days are entered only with + Past sale and the right sale date. The same work is never typed twice.', { law_type: 'app' }),
  law(5, 'Recording', 'Receipts are issued from MI or the Sales Log, never typed into Customer Receipts. A sale the app refuses (price below cost, not enough stock) is not forced: tell Joe.', { law_type: 'app' }),
  law(6, 'Know the words', 'App words: SOH stock on hand, SP selling price, CP cost price, WIC walk-in customer, GMC Grony Multimedia as customer, CAB cash at bank. Search the Handbook before asking.'),
  law(7, 'Flags', 'Every flag on Live Sale is fixed as soon as it appears. A flag is never left for the next day, and never hidden by editing the item to make it disappear.', { points: 2 }),
  law(8, 'Flags', 'Morning flag check: open 🚩 Flags on Live Sale. Every open flag is fixed now, using the steps shown. Answer all good, or report what you could not fix.', { law_type: 'recurring', frequency: 'daily', law_time: '09:30', minutes: 10, proof: 'question' }),
  law(9, 'Flags', 'Afternoon flag check: open 🚩 Flags on Live Sale and fix any new flag. Answer all good, or report what you could not fix.', { law_type: 'recurring', frequency: 'daily', law_time: '15:30', minutes: 10, proof: 'question' }),
  law(10, 'Flags', 'Closing flag check: no Live Sale flag is left open. Answer all good, or tell Joe which flag is still open and why.', { law_type: 'recurring', frequency: 'daily', law_time: '18:00', minutes: 5, proof: 'question' }),
]
module.exports = {
  key: 'sale',
  url: '/item?tab=loss&mode=sale',
  mock(p, m, q, body) {
    // Items with a few problems, and the flags that go with them (see sample.js). Edit > Save really changes the item.
    if (p === '/api/items/all') return S.allItems()
    if (p === '/api/flags') return S.flags()
    if (p === '/api/page-laws' && m === 'GET') return LAWS
    if (p === '/api/law-signatures') return { signed: {}, unsigned: onLawsPage ? LAWS.length : 0 }
    if (p === '/api/profile') return { display_name: 'demo', username: 'demo', photo_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=' }   // no "add your photo" pop-up in the video
    const im = p.match(/^\/api\/items\/(\d+)$/)
    if (im && m === 'PUT') {
      const it = S.allItems().find(i => i.id === Number(im[1]))
      if (it) {
        if (body.selling_rate != null) it.selling_price = body.selling_rate
        if (body.purchase_rate != null) it.cost_price = it.acp_price = body.purchase_rate
        if (body.cf_group) it.group = body.cf_group
      }
      return { id: Number(im[1]), item_name: it?.name, selling_rate: it?.selling_price, purchase_rate: it?.cost_price, gmc_type: it?.gmc_type }
    }
    // The demo staff member is already clocked in for the day.
    if (p === '/api/staff-times/today') return { today: [], mine: { actual_in: new Date(Date.now() - 4 * 3600000).toISOString() }, recent: [], opener: null, openerConfirmed: null, closer: null }
    if (p === '/api/sales/live-tap' && m === 'POST') {
      const it = S.items.find(i => i.id === Number(body.itemId)) || S.items[0]
      const tap = { id: 7100, item_id: it.id, item_name: it.name, price: Number(body.customPrice ?? it.selling_price), staff_name: 'demo', tapped_at: new Date().toISOString(), undone: false, receipt_id: 9001, quantity: Number(body.quantity) || 1, soh: it.soh - 1, is_gmc: false, customer_id_code: null, buyer_name: body.customerLabel || null }
      return { tap, whatsappUrl: null, buyerId: null, lineQuantity: tap.quantity, lineTotal: tap.price * tap.quantity }
    }
  },
  steps: [
    { caption: '<b>Live Sale</b>: <b>Search</b> the item, check <b>quantity</b> and <b>price</b>',
      say: 'This is Live Sale. Find the item in Search, and check the quantity and the price.',
      run: async (h, page) => {
        await h.wait(800)
        const box = page.getByPlaceholder('Search item…'); await h.tap(box); await h.type(box, 'mouse')
        const qty = page.getByPlaceholder('Qty').first(); await h.tap(qty); await qty.fill(''); await h.type(qty, '2')
        await h.point(page.locator('input[type=number]').nth(1))
      } },

    { caption: '<b>Who</b> is it for? Then tap the red <b>✓</b>',
      say: "Say who it is for: a G M number, a phone number, a name, or a short label. Then tap the red tick, and the sale goes into the Sales Log.",
      run: async (h, page) => {
        const who = page.getByPlaceholder('Who? (required)').first(); await h.tap(who); await h.type(who, 'Man in blue shirt')
        await h.tap(page.getByRole('button', { name: /Record sale for Wireless Mouse/ })); await h.wait(1200)
      } },

    { caption: '<b>WIC</b> = a sale. <b>GMC</b> = shop use. Several items = <b>MI</b>', lawRe: 'walk-in sale|several items',
      say: "When one customer buys several items, tap M I and add each to the basket. Company law: every walk-in sale goes in Live Sale with W I C on. G M C is only for the shop's own use, and it is not a sale. A customer buying several items is sold through M I: one basket, one receipt. Breaking it costs one penalty point. It exists so that every sale is recorded and every receipt is complete.",
      run: async (h, page) => {
        await h.point(page.getByRole('button', { name: 'WIC', exact: true }))
        await h.tap(page.getByRole('button', { name: 'MI', exact: true })); await h.wait(2500)   // the basket opens: add items, pick the customer, one receipt
        await h.tap(page.getByRole('button', { name: 'MI', exact: true }))   // and closes again
      } },

    { caption: 'Wrong sale? <b>Undo</b> it in the Sales Log', lawRe: 'receipts? (are|is)|typed into Customer',
      say: 'If you record a sale by mistake, undo it in the Sales Log. Law: receipts are issued from M I or the Sales Log, never typed into Customer Receipts. A sale the app refuses, such as a price below cost or not enough stock, is not forced: tell Joe. Breaking it costs one penalty point. A receipt typed by hand, or a forced sale, makes the books untrue.',
      run: async (h, page) => {
        await goto(page, '/item?tab=loss&mode=log')
        await h.point(page.locator('button[title="Undo"]').first())
      } },

    { caption: 'Past days: <b>+ Past sale</b> and the right date', lawRe: 'Past days|Past sale',
      say: 'Law: past days are entered only with plus Past sale and the right sale date. The same work is never typed twice. Breaking it costs one penalty point. Wrong dates break the daily figures, and then the Sales Log cannot be trusted.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: '+ Past sale' })) } },

    { caption: '<b>🚩 Flags</b>: every problem on this page, and how many',
      say: 'Now, flags. A flag is the app telling you a record is wrong. Every flag on Live Sale is in the Flags dropdown, with how many are open.',
      run: async (h, page) => {
        await goto(page, '/item?tab=loss&mode=sale')
        await h.point(flagsSel(page))
        await openList(page, flagsSel(page)); await h.wait(2500)
      } },

    { caption: 'Pick a flag: <b>what it means, why, and the steps</b>',
      say: 'Pick a flag, and a strip under the toolbar says what it means, why it matters, and the steps to clear it.',
      run: async (h, page) => {
        const sel = flagsSel(page)
        await h.tap(sel.locator('option', { hasText: 'No Selling Price' })); await closeList(sel); await h.wait(1800)
      } },

    { caption: 'Follow the steps: <b>tap the item, Edit, price, Save</b>',
      say: 'Follow the steps. Tap the item, tap Edit, type the selling price, and tap Save. The flag clears at once.',
      run: async (h, page) => {
        await h.tap(page.getByText('Lamination (A3)').first())
        await h.tap(page.getByRole('button', { name: /Edit/ }).first())
        const sp = page.getByPlaceholder('SP'); await h.tap(sp); await h.type(sp, '12')
        await h.tap(page.getByRole('button', { name: /Save/ }).first()); await h.wait(1500)
        await page.getByRole('button', { name: '×' }).last().click().catch(() => {})
        await flagsSel(page).selectOption(''); await h.wait(1200)
      } },

    { caption: 'Law: fix every flag as soon as it appears', lawRe: 'Every flag on Live Sale',
      say: 'This is company law: every flag on Live Sale is fixed as soon as it appears. It is never left for the next day, and never hidden by editing the item to make it disappear. Breaking it costs two penalty points. Open flags make prices wrong and stock untrue, and the real problem becomes harder to find.',
      run: async (h, page) => { await h.wait(1500); await h.point(page.getByText(/flags? open on Live Sale/).first()).catch(() => {}) } },

    { caption: 'The Daily Checklist asks about flags 3 times a day', lawRe: 'flag check',
      say: 'Three flag checks are company law, and each costs one penalty point. Morning flag check: open Flags on Live Sale. Every open flag is fixed now, using the steps shown. Answer all good, or report what you could not fix. Afternoon flag check: open Flags on Live Sale and fix any new flag. Answer all good, or report what you could not fix. Closing flag check: no Live Sale flag is left open. Answer all good, or tell Joe which flag is still open and why. They exist so that no flag survives the day.',
      run: async (h, page) => { await h.point(flagsSel(page)); await h.wait(1500) } },

    { caption: 'Item list: every good in the right group', lawRe: 'Item groups|right group',
      say: 'Law: once a week, item groups are checked: every good is in the right group. Breaking it costs one penalty point. Reports, filters and counts all depend on the group, and a wrongly grouped item hides in the wrong report.',
      run: async (h, page) => {
        const g = page.locator('select').filter({ hasText: 'Groups' }).first(); await openList(page, g); await h.wait(2500); await closeList(g)
      } },

    { caption: 'Prices: everyone sells at the current price', lawRe: 'price list|Prices',
      say: 'Law: once a month, the price list is checked: it is current, and every staff member has it. Breaking it costs one penalty point. A wrong price loses money on every sale of that item.',
      run: async (h, page) => { await h.point(page.locator('input[type=number]').nth(1)); await h.point(page.locator('input[type=number]').nth(7)) } },

    { caption: 'Know the words: SOH, SP, CP, WIC, GMC, CAB', lawRe: 'App words',
      say: 'Law: app words. S O H is stock on hand. S P is selling price. C P is cost price. W I C is walk-in customer. G M C is Grony Multimedia as customer. C A B is cash at bank. Search the Handbook before asking. Breaking it costs one penalty point. A misunderstood word becomes a wrong entry.',
      run: async (h, page) => { await h.point(page.getByText(/^ACP/).first()); await h.wait(1500) } },

    { caption: 'Everything for this page: <b>📜 Laws</b>',
      say: 'Everything about this page, the laws, the sanctions, why each law exists, and how to do things, is on the Laws button, with this video and its written transcript. Tap any line to jump to that part.',
      run: async (h, page) => { onLawsPage = true; await h.tap(page.getByText('📜 Laws').first()); await page.waitForURL(/\/laws/); await h.wait(2000)
        await page.locator('video').first().scrollIntoViewIfNeeded(); await h.wait(1500)
        await page.evaluate(() => window.scrollBy(0, 380)); await h.wait(1500) } },

    { caption: 'Sign each law. Penalty points: the owner approves',
      say: 'Every law on this page has a code, and you sign each one to show you have read it and will follow it. Breaking a law costs penalty points: twenty is a three day suspension, thirty is one week, and fifty is dismissal. The owner approves every sanction.',
      run: async (h, page) => {
        const code = page.getByText(/^LS-3/).first(); await code.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -120)); await h.wait(1200)
        await h.point(code)
        await h.point(page.getByRole('button', { name: /I have read this and will follow it/ }).first())
        await h.wait(1500)
      } },
  ],
}
