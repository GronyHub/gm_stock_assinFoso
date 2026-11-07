// Records a "how to use this page" guide from the REAL app, with a finger marker, tap ripples, step captions and
// British narration. No database is involved: the app runs with a dummy database address, signed in with a local
// token, and every /api data request is answered with made-up sample data (sample.js).
//
//   node record.js <scenario> [out.mp4]
//
// Needs: the app running on http://localhost:3005 (npx next start -p 3005) with AUTH_SECRET / DATABASE_URL set to
// dummy values; SESSION_TOKEN_FILE = a session token minted with that AUTH_SECRET; Playwright; ffmpeg; piper-tts
// with the voice at VOICE (en_GB-alba-medium.onnx).
const { chromium, devices } = require('playwright')
const { spawnSync } = require('child_process')
const fs = require('fs'), path = require('path')
const S = require('./sample')

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const TOKEN = fs.readFileSync(process.env.SESSION_TOKEN_FILE, 'utf8').trim()
const VOICE = process.env.VOICE
const WORK = process.env.WORK_DIR || path.join(__dirname, 'tmp')
fs.mkdirSync(WORK, { recursive: true })
const VIEW = { width: 405, height: 720 }          // phone-shaped; scaled up to 720x1280 when the video is made
const withHidden = u => u + (u.includes('?') ? '&' : '?') + 'sidebarHidden=1'   // the sidebar is hidden the way staff on phones usually have it
const overlay = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8')

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

// Answers every data request the pages make. Unknown GETs get an empty list; unknown writes get { ok: true }.
const TITLES = { sale: 'Live Sale', log: 'Sales Log', bills: 'Bills', expenses: 'Expenses', purchase_orders: 'Purchase Orders', vendors: 'Vendors', customers: 'Customers', counts: 'Counts', item360: 'Item 360', pl: 'P&L', cab: 'CAB (Cash at Bank)' }
function mocks(page, sc) {
  const titles = TITLES
  return page.route('**/api/**', async route => { try {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method(), q = u.searchParams
    if (p.startsWith('/api/auth')) return route.continue()
    // A scenario can answer its own page's data requests first (sc.mock(path, method, query, body) -> data | undefined).
    if (sc.mock) { let body = {}; try { body = JSON.parse(req.postData() || '{}') } catch {} const r = sc.mock(p, m, q, body); if (r !== undefined) return json(route, r) }
    if (p === '/api/page-guides') return json(route, m === 'GET' ? S.guide(q.get('page'), titles[q.get('page')] || q.get('page')) : { ok: true })
    if (p === '/api/items/all') return json(route, S.items)
    if (p === '/api/sales/live-taps' && m === 'GET') {
      if (q.get('from')) return json(route, [])
      const total = S.sumToday()
      return json(route, [...S.todayTaps.map(t => ({ ...t, receipt_total: total })), ...S.pastTaps])
    }
    if (p === '/api/sales/log-records') {
      const from = q.get('from') || '', to = q.get('to') || ''
      if (from.startsWith('2024')) return json(route, S.rec2024)
      return json(route, { receipts: [], lines: [] })
    }
    let mm = p.match(/^\/api\/sales\/live-taps\/(\d+)$/)
    if (mm && m === 'POST') { const t = S.todayTaps.find(x => x.id === Number(mm[1])); if (t && q.get('action') === 'undo') t.undone = true; return json(route, { ok: true }) }
    mm = p.match(/^\/api\/sales\/(\d+)$/)
    if (mm && m === 'PUT') {
      const body = JSON.parse(req.postData() || '{}')
      if (body.cash_counted != null) S.todayTaps.forEach(t => { t.receipt_cash_counted = body.cash_counted })
      return json(route, { id: Number(mm[1]), invoice_amount: String(S.sumToday()), cash_counted: body.cash_counted })
    }
    if (p === '/api/flags') return json(route, {})
    if (p === '/api/user-permissions') return json(route, { demo: { cash: true, manage: true, pl: true } })
    if (p === '/api/pane-order' || p === '/api/pane-labels' || p === '/api/pane-groups' || p === '/api/pane-hidden' || p === '/api/app-settings') return json(route, {})
    if (p === '/api/stock/count-progress') return json(route, { total: 0, doneToday: 0 })
    if (p === '/api/staff-times/today') return json(route, { today: [], mine: null, recent: [], opener: null, openerConfirmed: null, closer: null })
    if (p === '/api/presence' || p === '/api/push/heartbeat' || m !== 'GET') return json(route, { ok: true })
    return json(route, [])
  } catch (e) { console.error('MOCK ERROR', route.request().url(), e.message); route.fulfill({ status: 500, body: 'mock error' }) } })
}

function narrate(text, name) {
  const wav = path.join(WORK, name + '.wav')
  const r = spawnSync('python3', ['-m', 'piper', '-m', VOICE, '-f', wav, '--length-scale', '1.04', '--sentence-silence', '0.35'], { input: text })
  if (r.status !== 0) throw new Error('piper failed: ' + String(r.stderr))
  const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).stdout.toString()
  return { wav, dur: parseFloat(d) }
}

async function main() {
  const [, , scenarioName, outArg] = process.argv
  const sc = require('./scenarios/' + scenarioName)
  const out = outArg || path.join(WORK, sc.key + '.mp4')
  const browser = await chromium.launch()
  const cookie = [{ name: 'authjs.session-token', value: TOKEN, url: BASE }]

  // Warm-up (not recorded): hide the sidebar, the way staff on phones usually have it, and keep that for the recording.
  const warm = await browser.newContext({ ...devices['Pixel 7'], viewport: VIEW, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 5.6977, longitude: -1.2788 } })
  await warm.addCookies(cookie)
  const wp = await warm.newPage(); await mocks(wp, sc)
  await wp.goto(BASE + withHidden(sc.url), { waitUntil: 'networkidle' }); await wp.waitForTimeout(1500)
  const hide = wp.locator('button[title="Hide sidebar"], button[title="Hide"]').first()
  if (await hide.count()) await hide.click().catch(() => {})
  await wp.waitForTimeout(500)
  const state = await warm.storageState(); await warm.close()

  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: VIEW, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 5.6977, longitude: -1.2788 }, storageState: state, recordVideo: { dir: WORK, size: VIEW } })
  await ctx.addCookies(cookie)
  await ctx.addInitScript(overlay)
  await ctx.addInitScript(() => setInterval(() => { // the "notifications blocked" banner is noise in a guide
    for (const el of document.querySelectorAll('div')) if (el.children.length < 6 && !el.querySelector('main, nav, input') && /Notifications are (blocked|off)/.test(el.textContent || '') && el.textContent.length < 120) { let n = el; for (let k = 0; k < 2 && n.parentElement && n.parentElement.children.length === 1 && !n.parentElement.querySelector('main, nav'); k++) n = n.parentElement; n.style.display = 'none' }
  }, 300))
  const t0 = Date.now()
  const page = await ctx.newPage()
  page.on('dialog', d => d.accept())
  if (process.env.DEBUG_API) page.on('response', async r => { const u = r.url(); if (/log-records|live-taps/.test(u)) console.log('API', r.status(), u.replace(BASE, ''), (await r.text().catch(() => '')).slice(0, 80)) })
  page.on('console', m => { if (process.env.DEBUG_API && m.type()==='error') console.log('CONSOLE', m.text().slice(0,300)) }); page.on('pageerror', e => { if (process.env.DEBUG_API) console.log('PAGEERR', String(e).slice(0,400)) })
  await mocks(page, sc)
  await page.goto(BASE + withHidden(sc.url), { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const h = {
    page,
    async caption(html) { await page.evaluate(x => window.__demo.caption(x), html) },
    async wait(ms) { await page.waitForTimeout(ms) },
    async point(loc) {
      await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox()
      const x = b.x + b.width / 2, y = b.y + b.height / 2
      await page.evaluate(([a, c]) => window.__demo.move(a, c), [x, y]); await page.waitForTimeout(700)
      await page.evaluate(([a, c, r]) => { window.__demo.highlight(r) }, [x, y, b]); await page.waitForTimeout(900)
      await page.evaluate(() => window.__demo.highlight(null))
    },
    async tap(loc) {
      await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox()
      const x = b.x + b.width / 2, y = b.y + b.height / 2
      await page.evaluate(([a, c]) => window.__demo.move(a, c), [x, y]); await page.waitForTimeout(750)
      await page.evaluate(([a, c]) => window.__demo.tap(a, c), [x, y]); await page.waitForTimeout(200)
      await loc.click(); await page.waitForTimeout(600)
    },
    async pick(loc, value) { await h.tap(loc).catch(() => {}); await loc.selectOption(value); await page.waitForTimeout(900) },
    async type(loc, text) { await loc.pressSequentially(text, { delay: 220 }); await page.waitForTimeout(500) },
  }

  if (process.env.SHOT) { // preview: just look at the page with its sample data
    await page.waitForTimeout(2500); if (process.env.EVAL) console.log(await page.evaluate(process.env.EVAL)); await page.screenshot({ path: process.env.SHOT }); await ctx.close(); await browser.close(); return
  }
  const marks = []
  for (let i = 0; i < sc.steps.length; i++) {
    const st = sc.steps[i], n = narrate(st.say, `${sc.key}_${i}`)
    const start = Date.now() - t0
    marks.push({ wav: n.wav, at: start + 350 })
    await h.caption(st.caption || '')
    try { await st.run(h, page) } catch (e) { await page.screenshot({ path: path.join(WORK, 'fail.png') }); throw e }
    if (process.env.STEP_SHOTS) await page.screenshot({ path: path.join(WORK, `s_${sc.key}_${i}.png`) })
    const spent = Date.now() - t0 - start
    await page.waitForTimeout(Math.max(500, n.dur * 1000 + 900 - spent)) // let the narration finish before the next step
  }
  await h.caption('')
  await page.waitForTimeout(600)
  const video = await page.video().path()
  await ctx.close(); await browser.close()

  // Narration is placed at each step's start; the screen recording is converted to mp4.
  const args = ['-loglevel', 'error', '-y', '-i', video]
  marks.forEach(m => args.push('-i', m.wav))
  const fc = marks.map((m, i) => `[${i + 1}:a]adelay=${m.at}|${m.at}[a${i}]`).join(';') + ';' + marks.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${marks.length}:normalize=0:dropout_transition=0[a]`
  args.push('-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-vf', 'scale=720:1280:flags=lanczos,unsharp=5:5:0.7', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out)
  const r = spawnSync('ffmpeg', args); if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr)
  console.log('wrote', out)
}
main().catch(e => { console.error(e); process.exit(1) })
