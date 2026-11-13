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
  mkTap(today, '14:12', 4, 1, 55, { ...cust.kofi, wa_sent_at: at(today, '14:13') }, { staff_name: 'joe' }),
  mkTap(today, '12:30', 10, 2, 15, label('Man in blue shirt')),
  mkTap(today, '11:05', 1, 2, 70, { ...cust.ama, invoice_id: 801, invoice_number: 'RCT-261107-04121', wa_sent_at: at(today, '11:06') }),
  mkTap(today, '09:48', 3, 1, 20, label('Boy with school bag'), { staff_name: 'bino' }),
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


// Suppliers, customers and bills (all invented)
const vendors = [
  [41, 'Kwame Paper Supplies', 'Kwame Paper Supplies Ltd', '0244001122', 'Assin Fosu', 4, 5200, 700, 2],
  [42, 'Accra Toner Depot', 'Accra Toner Depot', '0201234567', 'Accra', 3, 6750, 0, 3],
  [43, 'Sika Computer Parts', 'Sika Computer Parts', null, 'Kumasi', 2, 1760, 880, 1],
].map(([id, display_name, company_name, phone, location, bill_count, bill_total, outstanding, payment_count]) => ({
  id, display_name, company_name, first_name: null, last_name: null, email: null, phone, location, status: 'Active', payment_terms_label: null,
  is_internal: false, notes: null, bill_count, bill_total: String(bill_total), outstanding: String(outstanding), payment_count, amount_paid: String(bill_total - outstanding),
}))
const customers = [
  [201, 'GM201', 'Ama Serwaa', '0241112233', 'Assin Foso', 14, 1250, 'Printing, Passport pictures'],
  [202, 'GM202', 'Kofi Mensah', '0207778899', 'Assin Fosu', 6, 640, 'Computer accessories'],
  [203, 'GM203', 'St. Peter Basic School', '0302554433', 'Assin Foso', 9, 3180, 'Printing, Toner'],
  [204, 'GM204', 'Efua Ampofo', null, null, 2, 95, null],
].map(([id, customer_id_code, display_name, phone, location, receipt_count, receipt_total, service_goods]) => ({
  id, customer_id_code, display_name, company_name: null, first_name: display_name.split(' ')[0], last_name: null, email: id === 201 ? 'ama.serwaa@example.com' : null, phone, extra_phones: [],
  location, status: 'Active', payment_terms_label: null, opening_balance: '0', credit_limit: null, notes: null, is_internal: false,
  whatsapp_group_added: id !== 204, last_visited: dayAgo(id - 200), service_goods, created_at: dayAgo(120) + 'T09:00:00Z', source: 'staff_added', added_by: 'demo',
  receipt_count, receipt_total: String(receipt_total), receipt_balance: '0', invoice_count: 0, invoice_total: '0', invoice_outstanding: '0',
}))
const bills = [
  [301, 'B-1045', 2, 'Kwame Paper Supplies', 1500], [302, 'B-1044', 5, 'Accra Toner Depot', 255], [303, 'B-1043', 9, 'Sika Computer Parts', 864],
].map(([id, bill_number, ago, vendor_name, total]) => ({ id, bill_number, bill_date: dayAgo(ago), vendor_name, total: String(total), status: 'paid', entered_by: 'demo', attachments: [] }))
const billLines = [
  [1, 301, 1, 'A4 SHEETS MAMBO', 30, 50], [2, 302, 6, 'A4 Lam. Singles', 100, 1.8], [3, 302, 10, 'Picture Printing (A4)', 50, 1.5],
  [4, 303, 4, 'Wireless Mouse', 12, 40], [5, 303, 8, 'Pendrive 16GB', 12, 32],
].map(([id, bill_id, item_id, item_name, q, p]) => ({ id, bill_id, item_id, item_name, quantity: String(q), unit_price: String(p), item_total: String(q * p), usage_unit: null, unresolved: false }))

const expenses = [
  [501, 1, 'Transport', 'Taxi to collect paper from Kumasi', 60], [502, 2, 'Electricity', 'ECG prepaid units', 120],
  [503, 4, 'Repairs', 'Photocopier roller replaced', 85], [504, 6, 'Internet', 'Monthly data bundle', 90], [505, 9, 'Rent', 'Shop rent for the month', 400],
].map(([id, ago, expense_account, description, amount]) => ({
  id, expense_date: dayAgo(ago), expense_account, description, vendor_name: null, amount: String(amount), cf_expense_type: null, cf_justify: null,
  is_property: false, property_status: null, property_type: null, related_item_id: null, availability: null, working: null, location: null,
  not_working_reason: null, not_available_reason: null, entered_by: 'demo', source: 'app', source_sheet: null, expense_group: null,
}))
const pos = [
  { id: 71, po_number: 'PO-0021', vendor_id: 41, vendor_name: 'Kwame Paper Supplies', order_date: dayAgo(4), expected_date: dayAgo(1), status: 'sent', notes: null, created_by: 'demo', created_at: dayAgo(4) + 'T10:00:00Z',
    lines: [{ id: 711, item_id: 1, item_name: 'A4 SHEETS MAMBO', qty_ordered: '40', qty_received: '0', unit_price: '50' }, { id: 712, item_id: 6, item_name: 'A4 Lam. Singles', qty_ordered: '100', qty_received: '0', unit_price: '1.8' }] },
  { id: 72, po_number: 'PO-0020', vendor_id: 42, vendor_name: 'Accra Toner Depot', order_date: dayAgo(12), expected_date: dayAgo(8), status: 'sent', notes: null, created_by: 'demo', created_at: dayAgo(12) + 'T10:00:00Z',
    lines: [{ id: 721, item_id: 10, item_name: 'Picture Printing (A4)', qty_ordered: '50', qty_received: '50', unit_price: '1.5' }] },
]
const counts = [
  [601, 1, 'A4 SHEETS MAMBO', 1, 143, 'Plain Papers'], [602, 4, 'Wireless Mouse', 2, 8, 'Mouse'], [603, 8, 'Pendrive 16GB', 3, 24, 'Storage Devices'],
  [604, 5, 'HDMI CABLE 5M', 5, 12, 'Cables'], [605, 6, 'A4 Lam. Singles', 7, 90, 'Stationery'],
].map(([id, item_id, item_name, ago, qty, cf_group]) => ({ id, item_id, item_name, count_date: dayAgo(ago), quantity_counted: String(qty), notes: null, counted_by: 'demo', source: 'manual', cf_group }))

// Live Sale flag demo (used by scenarios/sale.js only, so other guides keep their data): a few items with problems, and the
// /api/flags answer that goes with them. Fixing one through Edit > Save changes the item here, and the flag clears.
const flagItems = [
  [11, 'Lamination (A3)', 'Stationery', 30, 0, 4],                 // no selling price
  [12, 'Phone Pouch', '', 14, 25, 12],                             // no group
  [13, 'Hdmi Cable 5m', 'Cables', 3, 35, 22],                      // duplicate of #5
].map(([id, name, group, soh, sp, cp]) => ({
  id, name, group, soh, selling_price: sp, cost_price: cp, acp_price: cp, product_type: 'goods', gmc_type: '',
  converts_to_item_id: null, converts_to_name: null, derived_from_item_id: null, units_per_pack: 1, unit_time_seconds: null,
  image_url: null, needs_review: false, updated_at: new Date().toISOString(),
}))
const allItems = () => [...items, ...flagItems]
const flags = () => ({
  duplicates: [{ id1: 5, name1: 'HDMI CABLE 5M', id2: 13, name2: 'Hdmi Cable 5m' }],
  unlinkedNamed: [{ item_id: 8, item_name: 'Pendrive 16 GB', line_count: 4 }],
  noGroup: allItems().filter(i => !i.group).map(i => ({ id: i.id, item_name: i.name })), groupNames: [...new Set(allItems().map(i => i.group).filter(Boolean))],
})
const guide = (page, title) => ({ page, title, video_url: `/guides/${page}.mp4`, custom: false, seen: true, can_replace: false })

// The phone sidebar's staff rows: the roster must use the app's staff usernames to be shown, but the photos are invented
// silhouettes and no name is ever on screen. Points and hours are made up.
const avatar = bg => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="25" r="12" fill="#fff" opacity=".9"/><ellipse cx="32" cy="60" rx="21" ry="17" fill="#fff" opacity=".9"/></svg>`)
const staffRoster = [['joe', '#2563eb'], ['bino', '#9333ea'], ['james', '#16a34a'], ['grony', '#db2777']].map(([username, c]) => ({ username, active: true, photo_url: avatar(c) }))
const hm = n => { const d = new Date(Date.now() - n * 3600000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') }
const workedToday = () => [
  { staff_name: 'joe', actual_in: hm(5), actual_out: null, on_break: false, worked_seconds: 3.5 * 3600 },
  { staff_name: 'bino', actual_in: hm(4), actual_out: null, on_break: true, worked_seconds: 2.4 * 3600 },
  { staff_name: 'demo', actual_in: hm(4), actual_out: null, on_break: false, worked_seconds: 3 * 3600 },
]
const staffPoints = { joe: 0, bino: 0, james: 0, grony: 0, demo: 0 }
const penaltyMe = { points: 0, pilotPoints: 0, learning: false, countingFrom: dayAgo(60), warnings: 0, fadeIn: null, next: null, entries: [], sanctions: [] }

module.exports = { avatar, staffRoster, workedToday, staffPoints, penaltyMe, flagItems, allItems, flags, today, dayAgo, items, todayTaps, pastTaps, sumToday, rec2024, cust, guide, at, vendors, customers, bills, billLines, expenses, pos, counts }
