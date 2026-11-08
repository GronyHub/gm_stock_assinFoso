// Takes screenshots of the REAL app (phone-sized) for the category training videos. The app runs with a dummy database
// and every /api request is answered with made-up data below, the same way the page-guide recorder in docs/guides/real works.
//   AUTH_SECRET=... node shots.js <outdir>        (app on http://localhost:3005)
const { chromium, devices } = require('playwright')
const path = require('path'), fs = require('fs')
const { encode } = require('/home/user/gm_stock_assinfoso/node_modules/@auth/core/jwt')
const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.argv[2] || path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })
const VIEW = { width: 405, height: 720 }
const NOW = new Date('2026-11-10T10:20:00Z')          // a Tuesday, 10:20 in the shop
const DAY = '2026-11-10'

const T = (id, section, time, title, icon, o = {}) => ({ id, section, time, title, icon, how: null, kind: 'tap', prop_filter: null, frequency: 'daily', weekday: null, position: id, minutes: 5, days: null, ask: null, ok_label: null, issue_label: null, log_category: null, needs_photo: false, category: section, subcategory: null, law_id: id, ...o })
const tiles = [
  T(1, 'Customer service', '08:45', 'Call back anyone who phoned about an appointment as soon as you reach the shop.', '📞', { minutes: 3 }),
  T(2, 'Equipment, power & repairs', '08:35', 'UPS is on, charging and connected to the Epson EcoTanks.', '💡', { minutes: 2 }),
  T(3, 'Adverts & marketing', '08:40', 'Check the 32-inch TV is on and playing the company advert on repeat.', '📺', { minutes: 3 }),
  T(4, 'Cleanliness & safety', '08:45', 'Opening clean: floor mopped; printers, tables and showcases dusted. Take a photo of the clean shop.', '🧹', { kind: 'entry', needs_photo: true, log_category: 'cleanliness', how: 'Mop the whole floor\nDust printers, tables and showcases\nTake one clear photo of the floor and counter' }),
  T(5, 'Shop display & arrangement', '09:05', 'Arrangement check with a photo: goods in like terms, old goods in front and new behind, nothing on the floor.', '🪑', { kind: 'entry', needs_photo: true, log_category: 'arrangement' }),
  T(6, 'Staff management', '09:00', 'Dress code: everyone at work is wearing the company T-shirt and the employee tag.', '👕', { kind: 'persons', ask: 'Dress code: everyone at work is wearing the company T-shirt and the employee tag.', log_category: 'staff_dress_log', minutes: 3 }),
  T(7, 'Security & privacy', '09:15', 'Joe checks the CCTV app: every camera is showing.', '🔒', { minutes: 3 }),
  T(8, 'Equipment, power & repairs', '09:20', "Every printer's letter sticker matches its name on the screen.", '🖨️', { minutes: 3 }),
  T(9, 'Equipment, power & repairs', '09:25', 'Every printer is tested and faults are reported.', '🖨️', { minutes: 10 }),
  T(10, 'Adverts & marketing', '11:30', 'Record at least one video clip every day and save it in the Drive Video folder.', '📸', { minutes: 10, how: 'Hold the phone upright on the tripod, facing the light\nKeep it 10 to 30 seconds' }),
  T(11, 'Stock & records', '12:30', 'COUNT NOW items counted; warning banners cleared.', '📦', { minutes: 10 }),
  T(12, 'Equipment, power & repairs', '17:20', 'Repair Works: is anything in the shop broken or needing repair?', '🔧', { kind: 'question', ask: 'Repair Works: is anything in the shop broken or needing repair?', ok_label: 'Nothing needs repair', issue_label: 'Report a repair', log_category: 'repair_works', minutes: 3 }),
  T(13, 'Customer service', '17:15', 'Check the complaint log on the left of the glass showcase.', '🧾', { minutes: 5 }),
  T(14, 'Security & privacy', '18:20', 'Unfortunate events: did anything unfortunate happen today?', '⚠️', { kind: 'question', ask: 'Unfortunate events: did anything unfortunate happen today?', ok_label: 'Nothing happened', issue_label: 'Report an event', log_category: 'unfortunate_events_log', minutes: 3 }),
  T(15, 'Adverts & marketing', '15:00', "Edit the day's clip in CapCut and post it: TikTok first, then a Facebook Reel, then WhatsApp Status and the group.", '📱', { minutes: 15 }),
  T(16, 'Customers & WhatsApp', '08:35', "WhatsApp Business is working and the owner's UK devices are still linked.", '💬', { minutes: 2 }),
  T(17, 'Staff management', '08:30', 'Opening questions answered in the app (Opener).', '🌅', { minutes: 5 }),
  T(18, 'Cleanliness & safety', '08:50', 'Fire check: the extinguisher is in place and unblocked with the gauge in the green, and the gate and exits are clear.', '🧯', { minutes: 3 }),
  T(19, 'Cleanliness & safety', '09:00', 'Cable check: no cable lies across any path or walkway, and no extension board is plugged into another.', '🔌', { minutes: 3 }),
  T(20, 'Customer service', '10:00', 'Greet every customer within 10 seconds.', '👋', { minutes: 3 }),
]
const events = [1, 2, 3, 16, 17, 18, 19, 8].map((tid, i) => ({ id: 100 + i, tile_id: tid, day: DAY, value: 'Done', note: null, extra: {}, recorded_by: 'bino', recorded_at: `${DAY}T08:5${i}:00Z` }))
const laws = [
  { id: 1, text: 'Opening clean: floor mopped; printers, tables and showcases dusted with rag and brush. Take a photo of the clean shop.', scope_key: 'Cleanliness & safety', category: 'Cleanliness & safety', subcategory: 'Daily cleaning', law_type: 'recurring', days: null, law_time: '08:45', frequency: 'daily', minutes: 5, dos: 'Mop the whole floor\nDust printers, tables and showcases\nTake one clear photo', donts: null, status: 'live', tile_id: 4, proof: 'photo', points: 1 },
  { id: 2, text: 'Every Wednesday, test the fire alarm.', scope_key: 'Cleanliness & safety', category: 'Cleanliness & safety', subcategory: 'Fire safety', law_type: 'recurring', days: 'wed', law_time: '10:00', frequency: 'weekly', minutes: 10, dos: 'Tell everyone before the test\nHold the test button until it is loud\nNo sound: fit a new battery and test again', donts: null, status: 'live', tile_id: 5, proof: 'tick', points: 1 },
  { id: 3, text: 'No smoking or naked flame. Keep ink and paper away from heat.', scope_key: 'Cleanliness & safety', category: 'Cleanliness & safety', subcategory: 'Fire safety', law_type: 'standing', days: null, law_time: null, frequency: null, minutes: null, dos: null, donts: 'Never use water on an electrical fire', status: 'live', tile_id: null, proof: 'tick', points: 1 },
  { id: 4, text: 'No cable lies across any path or walkway, and no extension board is plugged into another.', scope_key: 'Cleanliness & safety', category: 'Cleanliness & safety', subcategory: 'Cables and power', law_type: 'recurring', days: null, law_time: '09:00', frequency: 'daily', minutes: 3, dos: 'One board per station, off the floor', donts: 'Do not plug an extension board into another board', status: 'live', tile_id: 19, proof: 'tick', points: 1 },
  { id: 5, text: 'Greet every customer within 10 seconds.', scope_key: 'Customer service', category: 'Customer service', subcategory: 'Receiving customers', law_type: 'standing', days: null, law_time: null, frequency: null, minutes: null, dos: null, donts: null, status: 'live', tile_id: null, proof: 'tick', points: 1 },
]
const penalties = { points: 3, learning: false, countingFrom: '2026-11-22', warnings: 0, fadeIn: 4, next: { points: 20, days: 3, hours: 10, label: '3-day suspension' }, sanctions: [],
  entries: [{ id: 1, points: 2, kind: 'violation', reason: '2 checklist tasks left undone today (Cable check; Fire check)', day: '2026-11-06', counted: true, status: 'active' }, { id: 2, points: 1, kind: 'violation', reason: 'Not wearing the company T-shirt and employee tag', day: '2026-11-08', counted: true, status: 'active' }] }

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
async function mocks(page) {
  await page.route('**/api/**', async route => { try {
    const u = new URL(route.request().url()), p = u.pathname, m = route.request().method()
    if (p.startsWith('/api/auth')) return route.continue()
    if (p === '/api/daily-checks' && m === 'GET') return json(route, { day: DAY, today: DAY, tiles, events, adhoc: [], dayStart: 8 * 60 + 30, clockedIn: true, exempt: false, present: ['bino', 'james', 'marian'] })
    if (p === '/api/profile') return json(route, { id: 3, username: 'bino', display_name: 'Bino', email: 'bino@example.com', phone: '0244000000', role: 'staff', photo_url: '/logo-mark.png' })
    if (p === '/api/customer-service/daily') return json(route, { day: DAY, done: true })
    if (p === '/api/customer-service/ack') return json(route, { version: 1, mine: { version: 1, at: `${DAY}T08:00:00Z` } })
    if (p === '/api/penalties/me') return json(route, penalties)
    if (p === '/api/ratings/me') return json(route, { n: 12, avg: 4.6, low: 0, star: false, recent: [{ stars: 5, comment: 'Quick and polite service', rated_at: `${DAY}T09:00:00Z` }, { stars: 4, comment: null, rated_at: '2026-11-09T14:00:00Z' }] })
    if (p === '/api/page-laws') return json(route, laws)
    if (p === '/api/staff/profiles') return json(route, [])
    if (p === '/api/pane-order' || p === '/api/pane-labels' || p === '/api/pane-groups' || p === '/api/pane-hidden' || p === '/api/app-settings' || p === '/api/flags') return json(route, {})
    if (m !== 'GET') return json(route, { ok: true })
    return json(route, [])
  } catch (e) { route.fulfill({ status: 500, body: 'mock error' }) } })
}

;(async () => {
  const token = await encode({ token: { sub: '3', id: '3', name: 'Bino', username: 'bino', role: 'staff' }, secret: process.env.AUTH_SECRET, salt: 'authjs.session-token' })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: VIEW, deviceScaleFactor: 2, serviceWorkers: 'block' })
  await ctx.addCookies([{ name: 'authjs.session-token', value: token, url: BASE }])
  const page = await ctx.newPage()
  await page.clock.install({ time: NOW })
  await ctx.addInitScript(() => setInterval(() => { // the "notifications blocked" banner is noise in a training video
    for (const el of document.querySelectorAll('div')) if (el.children.length < 6 && !el.querySelector('main, nav, input') && /Notifications are (blocked|off)/.test(el.textContent || '') && (el.textContent || '').length < 120) { let n = el; for (let k = 0; k < 2 && n.parentElement && n.parentElement.children.length === 1 && !n.parentElement.querySelector('main, nav'); k++) n = n.parentElement; n.style.display = 'none' }
  }, 200))
  await mocks(page)
  const go = async (u, wait = 1800) => { await page.goto(BASE + u, { waitUntil: 'networkidle' }); await page.waitForTimeout(wait) }
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') })

  if (process.env.ONLY_RATE) { await go('/rate/demo'); await shot('rate'); await browser.close(); return }
  await go('/standards'); await shot('strip')
  await page.mouse.wheel(0, 120); await page.waitForTimeout(500); await shot('checklist')
  // tile pop-up: a tick tile read before it is done
  await page.getByRole('button', { name: /Record at least one video clip/ }).first().click().catch(async () => { await page.locator('button[title*="Record at least one video"]').first().click() })
  await page.waitForTimeout(700); await shot('tile'); await page.keyboard.press('Escape'); await page.mouse.click(200, 40); await page.waitForTimeout(400)
  await go('/standards')
  await page.locator('button[title*="Repair Works"]').first().click(); await page.waitForTimeout(700); await shot('question')
  await go('/standards')
  await page.locator('button[title*="Opening clean"]').first().click(); await page.waitForTimeout(700); await shot('photo')
  await go('/standards')
  await page.locator('button[title*="Dress code"]').first().click(); await page.waitForTimeout(700)
  const yes = page.getByRole('button', { name: '✓ Yes' }); const no = page.getByRole('button', { name: '✗ No' })
  await yes.nth(0).click(); await no.nth(1).click(); await yes.nth(2).click(); await page.waitForTimeout(400); await shot('persons')
  await go('/standards')
  await page.getByRole('button', { name: /Log an activity/ }).click(); await page.waitForTimeout(500)
  await page.getByRole('button', { name: '📢 Adverts & marketing' }).click(); await page.locator('textarea').fill('Filmed a customer collecting a banner, with permission, for tomorrow\'s post'); await page.waitForTimeout(400); await shot('adhoc')
  await go('/laws'); await shot('laws_cats')
  await go('/laws?cat=' + encodeURIComponent('Cleanliness & safety')); await shot('laws_cat')
  await go('/profile'); await shot('profile')
  await go('/rate/demo'); await shot('rate')
  await browser.close(); console.log('done', OUT)
})().catch(e => { console.error(e); process.exit(1) })
