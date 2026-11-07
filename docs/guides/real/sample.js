// Sample data for the real-app guide videos. Everything here is made up: no real customers, sales or records.
// The recorder (record.js) answers the app's data requests with this instead of a database.
const today = new Date().toISOString().slice(0, 10)
const dayAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const at = (day, hm) => `${day}T${hm}:00.000Z`

const items = [
  [1, 'A4 SHEETS MAMBO', 'Plain Papers', 143, 70, 50], [2, 'Printing (A4)', 'Printing Press Services', 500, 1, 0.15],
  [3, 'Passport Picture', 'Printing Press Services', 40, 20, 1], [4, 'Wireless Mouse', 'Mouse', 8, 55, 40],
  [5, 'HDMI CABLE 5M', 'Cables', 12, 35, 22], [6, 'A4 Lam. Singles', 'Stationery', 90, 5, 1.8],
  [7, 'Photocopies (A4)', 'Printing Press Services', 95, 1, 0.15], [8, 'Pendrive 16GB', 'Storage Devices', 24, 45, 32],
  [9, 'Large format 4ft Sticker', 'Large Format', 1694, 3, 2], [10, 'Picture Printing (A4)', 'Printing Press Services', 60, 15, 1.5],
].map(([id, name, group, soh, sp, cp]) => ({
  id, name, group, soh, selling_price: sp, cost_price: cp, acp_price: cp, product_type: 'goods', gmc_type: '',
  converts_to_item_id: null, converts_to_name: null, derived_from_item_id: null, units_per_pack: 1, unit_time_seconds: null,
  image_url: null, needs_review: false, updated_at: new Date().toISOString(),
}))

const cust = {
  ama: { customer_id_code: 'GM201', customer_name: 'Ama Serwaa', customer_phone: '0241112233' },
  kofi: { customer_id_code: 'GM202', customer_name: 'Kofi Mensah', customer_phone: '0207778899' },
}
// today's walk-in sales, newest first (id, item id, qty, price, time, who)
let nextTap = 7000
const mkTap = (day, hm, itemId, qty, price, who, extra = {}) => {
  const it = items.find(i => i.id === itemId)
  return {
    id: nextTap++, item_id: itemId, item_name: it.name, price, staff_name: 'demo', tapped_at: at(day, hm), undone: false,
    receipt_id: day === today ? 9001 : 9000, quantity: qty, soh: it.soh - qty, is_gmc: false,
    customer_id_code: null, customer_name: null, customer_phone: null, buyer_id: null, buyer_name: null, buyer_phone: null,
    invoice_id: null, invoice_number: null, wa_sent_at: null,
    receipt_cash_counted: day === today ? null : 2100, receipt_total: day === today ? 0 : 2060,
    ...who, ...extra,
  }
}
const label = n => ({ buyer_name: n })
const todayTaps = [
  mkTap(today, '15:40', 6, 3, 5, label('Lady in red')),
  mkTap(today, '14:12', 4, 1, 55, { ...cust.kofi, wa_sent_at: at(today, '14:13') }),
  mkTap(today, '12:30', 10, 2, 15, label('Man in blue shirt')),
  mkTap(today, '11:05', 1, 2, 70, { ...cust.ama, invoice_id: 801, invoice_number: 'RCT-261107-04121', wa_sent_at: at(today, '11:06') }),
  mkTap(today, '09:48', 3, 1, 20, label('Boy with school bag')),
  mkTap(today, '08:55', 2, 40, 1, label('Teacher')),
]
const pastTaps = [
  mkTap(dayAgo(1), '16:20', 5, 1, 35, label('Man on motor')),
  mkTap(dayAgo(1), '13:02', 9, 20, 3, { ...cust.ama }),
  mkTap(dayAgo(1), '10:15', 8, 2, 45, label('Student')),
]
const sumToday = () => todayTaps.filter(t => !t.undone).reduce((s, t) => s + t.price * t.quantity, 0)

// Older records (back to 2023): day receipts, with some lines and a photo on one day.
const photo = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260"><rect width="200" height="260" fill="#fffdf4"/><rect x="0" y="0" width="200" height="26" fill="#d7e3f4"/><text x="10" y="18" font-family="Arial" font-size="12" fill="#233">DAILY SALES FORM</text>' +
  Array.from({ length: 8 }, (_, i) => `<line x1="10" y1="${52 + i * 24}" x2="190" y2="${52 + i * 24}" stroke="#889" stroke-width="1"/><text x="12" y="${48 + i * 24}" font-family="cursive" font-size="11" fill="#225">printing ${i + 1}</text>`).join('') + '</svg>')
const rec2024 = {
  receipts: [
    { id: 5101, receipt_number: 'SR-2024-0512', day: '2024-05-12', customer_name: null, is_gmc: false, total: '842.50', cash_counted: '860', attachments: [{ url: photo, type: 'image/png', name: 'daily-form.png' }] },
    { id: 5100, receipt_number: 'SR-2024-0511', day: '2024-05-11', customer_name: null, is_gmc: false, total: '655.00', cash_counted: '655', attachments: [] },
  ],
  lines: [
    [1, 5101, '2024-05-12', 'Printing (A4)', 120, 1, 120], [2, 5101, '2024-05-12', 'Photocopies (A4)', 80, 1, 80], [3, 5101, '2024-05-12', 'A4 SHEETS MAMBO', 3, 65, 195],
    [4, 5101, '2024-05-12', 'Passport Picture', 12, 15, 180], [5, 5101, '2024-05-12', 'Large format 4ft Sticker', 22, 3, 66],
    [6, 5100, '2024-05-11', 'Printing (A4)', 95, 1, 95], [7, 5100, '2024-05-11', 'Binding', 4, 20, 80], [8, 5100, '2024-05-11', 'Wireless Mouse', 2, 45, 90],
  ].map(([id, rid, day, item_name, quantity, item_price, item_total]) => ({ id, receipt_id: rid, day, is_gmc: false, item_id: null, item_name, quantity: String(quantity), item_price: String(item_price), item_total: String(item_total), source: 'zoho_historical' })),
}

const guide = (page, title) => ({ page, title, video_url: `/guides/${page}.mp4`, custom: false, seen: true, can_replace: false })

module.exports = { today, dayAgo, items, todayTaps, pastTaps, sumToday, rec2024, cust, guide, at }
