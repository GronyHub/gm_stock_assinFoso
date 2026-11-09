// Live Sale guide: the real page, driven step by step (see ../record.js).
const S = require('../sample')
module.exports = {
  key: 'sale',
  url: '/item?tab=loss&mode=sale',
  mock(p, m, q, body) {
    // The demo staff member is already clocked in for the day.
    if (p === '/api/staff-times/today') return { today: [], mine: { actual_in: new Date(Date.now() - 4 * 3600000).toISOString() }, recent: [], opener: null, openerConfirmed: null, closer: null }
    if (p === '/api/sales/live-tap' && m === 'POST') {
      const it = S.items.find(i => i.id === Number(body.itemId)) || S.items[0]
      const tap = { id: 7100, item_id: it.id, item_name: it.name, price: Number(body.customPrice ?? it.selling_price), staff_name: 'demo', tapped_at: new Date().toISOString(), undone: false, receipt_id: 9001, quantity: Number(body.quantity) || 1, soh: it.soh - 1, is_gmc: false, customer_id_code: null, buyer_name: body.customerLabel || null }
      return { tap, whatsappUrl: null, buyerId: null, lineQuantity: tap.quantity, lineTotal: tap.price * tap.quantity }
    }
  },
  steps: [
    { caption: '<b>Live Sale</b>: record every sale as it happens',
      say: 'This is Live Sale. Every sale in the shop is recorded here, the moment it happens. Each item has its own card.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '1. Find the item: type its name in <b>Search</b>',
      say: 'First, find the item. Type its name in Search, and the cards narrow down. You can also use All and Groups.',
      run: async (h, page) => {
        const box = page.getByPlaceholder('Search item…'); await h.tap(box); await h.type(box, 'mouse'); await h.wait(800)
      } },

    { caption: '2. Check the <b>quantity</b> and the <b>price</b>',
      say: 'Check the quantity and the price on the card. Change them if the customer bought more than one, or agreed a different price.',
      run: async (h, page) => {
        const qty = page.getByPlaceholder('Qty').first(); await h.tap(qty); await qty.fill(''); await h.type(qty, '2')
        await h.point(page.locator('input[type=number]').nth(1))
      } },

    { caption: '3. <b>Who</b> is it for? A GM number, phone, name or label',
      say: "Next, say who the sale is for. Type the customer's G M number, phone number or name. If you don't know them, type a short label, such as man in blue shirt.",
      run: async (h, page) => {
        const who = page.getByPlaceholder('Who? (required)').first(); await h.tap(who); await h.type(who, 'Man in blue shirt')
      } },

    { caption: '4. Tap the red <b>✓</b> to record the sale',
      say: 'Then tap the red tick to record the sale. It goes straight into the Sales Log.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: /Record sale for Wireless Mouse/ })); await h.wait(1500) } },

    { caption: 'New phone number? The customer form opens',
      say: 'If you type a phone number we do not know, the customer form opens, so you can register them as you sell.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Several items, one customer: <b>MI</b>', lawRe: 'several items|one basket|MI:|through MI',
      say: 'When one customer buys several items, tap M I. Add each item to the basket, pick the customer, and issue one receipt for everything. This is company law: a customer buying several items is sold through M I, one basket and one receipt. Breaking it costs one penalty point. It exists so that every receipt is complete and the customer never gets two.',
      run: async (h, page) => { await h.tap(page.getByRole('button', { name: 'MI', exact: true })); await h.wait(2000) } },

    { caption: '<b>WIC</b> = a sale. <b>GMC</b> = shop use, not a sale', lawRe: 'walk-in sale',
      say: 'Keep the switch on W I C for a sale to a customer. G M C is only for things the shop uses itself, and it is not a sale. The law says: every walk-in sale goes in Live Sale with W I C on. Breaking it costs one penalty point. A sale that is not recorded makes stock and cash wrong, and hides real profit.',
      run: async (h, page) => { await h.point(page.getByRole('button', { name: 'WIC', exact: true })) } },

    { caption: 'Wrong sale? Undo it in the <b>Sales Log</b>', lawRe: 'receipts? (are|is)|never typed',
      say: 'If you record a sale by mistake, undo it in the Sales Log. Never tap again to correct it, because that records a second sale. Receipts are issued from M I or the Sales Log, never typed by hand. A sale the app refuses, such as a price below cost, is not forced: tell Joe. One penalty point.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Past days: <b>+ Past sale</b> and the right date', lawRe: 'Past days|Past sale',
      say: 'Law: past days are entered only with plus Past sale and the right sale date. The same work is never typed twice. Breaking it costs one penalty point. Wrong dates break the daily figures, and then the Sales Log cannot be trusted.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: '<b>Flags</b>: every problem on this page, in one place',
      say: 'Now, flags. A flag is the app telling you a record is wrong. Every flag on Live Sale is in one place: the Flags dropdown. The number shows how many are open.',
      run: async (h, page) => { await h.point(page.locator('select').filter({ hasText: 'Flags' }).first()).catch(() => {}); await h.wait(1500) } },

    { caption: 'Pick a flag: it says what it means and how to fix it',
      say: 'Pick a flag, and a strip under the toolbar says what it means, why it matters, and the exact steps to clear it. Follow the steps, and the flag clears at once.',
      run: async (h, page) => { await h.wait(3000) } },

    { caption: 'The flags on Live Sale',
      say: 'The flags are: no selling price, no cost price, no group, empty row, duplicate items, unlinked sales, service violations, unknown quantity, G M C pack overage, net gain, negative stock, and the old alias checks. Most are fixed by tapping the item, tapping Edit, filling the missing detail, and tapping Save.',
      run: async (h, page) => { await h.wait(3500) } },

    { caption: 'Law: fix every flag as soon as it appears', lawRe: 'Every flag on Live Sale',
      say: 'This is company law: every flag on Live Sale is fixed as soon as it appears. It is never left for the next day, and never hidden by editing the item just to make it disappear. Breaking it costs two penalty points. Open flags make prices wrong and stock untrue, and the real problem becomes harder to find.',
      run: async (h, page) => { await h.wait(3000) } },

    { caption: 'The Daily Checklist asks about flags three times a day', lawRe: 'flag check',
      say: 'The Daily Checklist asks about flags three times a day: a morning check, an afternoon check, and a closing check. Open Flags, fix what is open, then answer all good, or report what you could not fix. No Live Sale flag may be left open when you close.',
      run: async (h, page) => { await h.wait(3000) } },

    { caption: 'Item list: every good in the right group', lawRe: 'Item groups|right group',
      say: 'Law: once a week, the item groups are checked, and every good is in the right group. Reports, filters and counts all depend on the group. A wrongly grouped item hides in the wrong report.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Prices: everyone sells at the current price', lawRe: 'price list|Prices',
      say: 'Law: once a month, the price list is checked. It is current, and every staff member has it. A wrong price loses money on every sale of that item.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Know the words: SOH, SP, CP, WIC, GMC, CAB', lawRe: 'App words',
      say: 'Law: know the app words. S O H is stock on hand. S P is selling price. C P is cost price. W I C is walk-in customer. G M C is Grony Multimedia as customer. C A B is cash at bank. A misunderstood word becomes a wrong entry.',
      run: async (h, page) => { await h.wait(2500) } },

    { caption: 'Sign each law. Penalty points are approved by the owner',
      say: 'Every law on this page has a code, and you sign each one in Company Laws to show you have read it and will follow it. Breaking a law costs penalty points. Twenty points is a three day suspension, thirty is one week, and fifty is dismissal. The owner approves every sanction.',
      run: async (h, page) => { await h.wait(3000) } },

    { caption: 'Everything for this page: <b>📜 Laws</b>',
      say: 'Everything about this page, the laws, the sanctions, why each law exists, and how to do things, is on the Laws button. This video, and its written transcript, are there. Tap any line to jump to that part.',
      run: async (h, page) => { await h.point(page.getByRole('link', { name: /Laws/ }).first()).catch(() => {}); await h.wait(1500) } },
  ],
}
