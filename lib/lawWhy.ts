// Why each law exists: what it is there to solve, how it helps the business, and what not doing it costs.
// Written per subcategory, so every law under it shows the reason. A law can carry its own text later.
export type Why = { exists: string; solves: string; helps: string; loss: string }
const w = (exists: string, solves: string, helps: string, loss: string): Why => ({ exists, solves, helps, loss })

const BY_SUB: Record<string, Why> = {
  // Stock & records
  'Stock & records|Recording': w('Every sale must be in the app the moment it happens.', 'Sales that were never written down, typed twice, or forced past a warning.', 'The stock, cash and profit figures are true, so ordering and pricing decisions are made on facts.', 'An unrecorded sale makes stock look wrong, hides real profit, and lets cash disappear without a trace. Staff then waste hours hunting for the difference.'),
  'Stock & records|Item list': w('One clean list of items, each in the right group with the right name.', 'Duplicates, wrong groups and missing details that confuse sales and counts.', 'Staff find the right item in seconds and reports group correctly.', 'A duplicate or wrongly named item splits stock and sales across two records, so counts never match and customers wait while staff search.'),
  'Stock & records|Prices': w('Everyone sells at the same current price.', 'Staff quoting old or different prices.', 'Customers are charged correctly and the margin on each item is protected.', 'A wrong price loses money on every sale of that item, or loses the customer who was quoted too much.'),
  'Stock & records|Counts': w('The shelf is counted on schedule and the result entered at once.', 'Stock that the app says is there but is not, and the reverse.', 'Stock figures stay trustworthy, so we reorder at the right time and spot theft or waste early.', 'Uncounted stock hides losses until they are large, goods run out unnoticed, and sales are lost because the item was not on the shelf.'),
  'Stock & records|Know the words': w('The whole team uses the same words for the same things.', 'Mix-ups between SOH, SP, CP, WIC, GMC and CAB.', 'Fewer mistakes and faster training for new staff.', 'A misunderstood word leads to a wrong entry, and wrong entries become wrong stock and cash figures.'),
  'Stock & records|Understanding': w('Staff who understand Live Sale make fewer mistakes.', 'Wrong taps, wrong words and guessing.', 'Faster, more accurate selling, and new staff learn quickly.', 'Staff who do not understand the page record sales wrongly, and the errors surface later as lost stock or cash.'),
  'Stock & records|Flags': w('A flag is the app telling us a record is wrong.', 'Wrong prices, duplicates, missing groups and stock that does not add up, left to pile up.', 'Clean item data means true stock, true profit and fast, correct sales.', 'Open flags grow. Wrong prices lose money on every sale, and the real problem becomes harder to trace.'),
  'Stock & records|Sales Log': w('The Sales Log is the day\'s record of what was sold and received.', 'Days that do not add up and receipts that cannot be found.', 'The owner and Joe can trust each day\'s figures and answer any customer query quickly.', 'A day that does not reconcile cannot be trusted. Cash shortages and disputes with customers cannot be settled.'),
  'Stock & records|Item 360': w('Item 360 shows one item\'s whole story in one place.', 'Guessing why an item has a loss, a negative stock or a wrong price.', 'Problems are traced and fixed in minutes instead of hours.', 'Without it, staff fix symptoms, the real cause stays, and the same loss keeps coming back.'),
  'Stock & records|Losses and analytics': w('Losses and slow sellers are looked at on purpose, not by accident.', 'Stock lost quietly and money tied up in goods nobody buys.', 'We reorder what sells, stop buying what does not, and catch leaks early.', 'Unwatched losses grow every week and slow sellers tie up cash that should buy fast sellers.'),
  'Stock & records|Bills': w('Every purchase is recorded with its bill and a full list of goods.', 'Stock coming in with no record, so counts show a false gain or loss.', 'Cost prices are right, profit is right, and suppliers can be checked.', 'A missing bill gives wrong cost, wrong profit and false losses, and we cannot prove what we paid.'),
  'Stock & records|Purchase orders': w('We order on purpose, from a list, before we run out.', 'Last-minute buying and double orders.', 'Goods arrive when needed at the agreed price.', 'Stock-outs lose sales, and double or rushed orders waste cash.'),
  // Finance
  'Finance|Bills': w('Every bill is checked each week.', 'Bills with missing receipts, vendor names or totals that do not add up.', 'Our books match what we really paid.', 'Unchecked bills hide overpayment and errors, and make year-end accounts unreliable.'),
  'Finance|Mobile Money': w('Customers pay only to the company number.', 'Money sent to personal numbers.', 'All takings reach the business and can be traced.', 'Payments to a personal number cannot be tracked, and the shop loses money it earned.'),
  'Finance|CAB': w('Cash at bank is recorded and reconciled weekly.', 'Differences between the bank and the books going unnoticed.', 'We always know how much money the business really has.', 'Unreconciled cash lets mistakes and theft hide, and the owner makes decisions on wrong numbers.'),
  'Finance|Cuttings': w('Cuttings (waste paper) are accounted for.', 'Paper offcuts leaving the shop unrecorded.', 'Waste is controlled and reused where possible.', 'Uncontrolled waste is lost stock and lost money.'),
  'Finance|Expenses': w('Every expense is recorded with its receipt.', 'Money spent with no record.', 'We know where the money goes and can cut waste.', 'Unrecorded spending cannot be checked, and profit looks better than it is.'),
  'Finance|Vendors': w('Supplier details are kept right.', 'Wrong names, numbers or terms.', 'Orders and payments go to the right place.', 'Mistakes in supplier details cause late deliveries and wrong payments.'),
  'Finance|P&L': w('Profit and loss is read regularly and properly.', 'Decisions made on feeling instead of numbers.', 'The owner sees what earns and what costs.', 'Problems in margin or spending grow unseen until they are serious.'),
  // Customers & WhatsApp
  'Customers & WhatsApp|New customers': w('Every new customer is registered properly.', 'Customers with no name or number on record.', 'We can follow up, offer repeat work and send receipts.', 'A customer we cannot contact is a sale we cannot repeat.'),
  'Customers & WhatsApp|Bulk messages': w('Bulk messages go out on schedule and follow the rules.', 'Irregular, spammy or forgotten messaging.', 'Customers hear from us at the right time and come back.', 'No messages means no repeat business, and careless messages annoy customers or get our number blocked.'),
  'Customers & WhatsApp|Responding': w('Every message is answered quickly and politely.', 'Customers waiting hours for a reply.', 'Fast replies turn enquiries into sales.', 'A slow reply sends the customer to a competitor.'),
  'Customers & WhatsApp|Growing the page': w('We keep adding followers and contacts.', 'A page that stops growing.', 'More people see our offers, which means more sales.', 'A stale page loses reach and the business loses new customers.'),
  'Customers & WhatsApp|Chat rules': w('Customer chats follow clear rules.', 'Unprofessional or risky messages.', 'Customers trust us and the brand stays respected.', 'One bad message can lose a customer and damage the shop\'s name.'),
  'Customers & WhatsApp|Records': w('Customer records are accurate.', 'Wrong or duplicate customer details.', 'We reach the right person every time.', 'Wrong details waste staff time and lose customers.'),
  'Customers & WhatsApp|Sales and customers': w('A sale is linked to the right customer.', 'Sales with no customer behind them.', 'We can find any receipt and know who our best customers are.', 'Without the link, receipts cannot be found and loyal customers go unrewarded.'),
  'Customers & WhatsApp|WhatsApp': w('WhatsApp is used for the business the right way.', 'Business messages mixed with personal use.', 'A clean, professional channel to customers.', 'Mixed use leaks customer information and loses messages.'),
  // Customer service
  'Customer service|Receiving customers': w('Every customer is greeted and helped quickly.', 'Customers ignored or kept waiting.', 'Customers feel welcome, buy more and come back.', 'An ignored customer leaves, and tells others.'),
  'Customer service|Complaints': w('Complaints are handled calmly and fixed.', 'Arguments and unresolved complaints.', 'A fixed complaint often becomes a loyal customer.', 'An unresolved complaint loses the customer and harms our reputation.'),
  'Customer service|Quality of work': w('Work is checked before it leaves the shop.', 'Mistakes found by the customer, not by us.', 'Less rework, happier customers, a name for quality.', 'Faulty work means reprinting, wasted materials and lost customers.'),
  'Customer service|Callbacks': w('Customers who were promised a call get it.', 'Forgotten promises.', 'Trust builds, repeat orders follow.', 'A forgotten callback shows we do not care and loses the order.'),
  'Customer service|Customer Service Code': w('One code that every staff member lives by.', 'Different staff treating customers differently.', 'Every customer gets the same good service from anyone.', 'Inconsistent service makes customers go to the competitor who is consistent.'),
  // Adverts
  'Adverts & marketing|Video clips': w('We record fresh clips every day.', 'Nothing new to post.', 'A steady flow of content keeps the shop visible.', 'No content means no reach, and fewer walk-ins and enquiries.'),
  'Adverts & marketing|Posting': w('The day\'s clip is edited and posted everywhere.', 'Content made but never posted.', 'More people see us, so more customers come.', 'Unposted work is wasted effort and lost sales.'),
  'Adverts & marketing|Ideas': w('We try a new idea every day.', 'Boring, repeated content.', 'Fresh ideas find what customers like.', 'Stale content loses attention.'),
  'Adverts & marketing|Replies': w('Every comment and message gets an answer.', 'Questions left unanswered.', 'Interest turns into orders.', 'An unanswered question is a lost sale.'),
  'Adverts & marketing|TV display': w('The shop TV and jingle always run.', 'A dark TV or silent jingle.', 'Passers-by see our services all day.', 'A silent shop front loses walk-in customers who never knew what we offer.'),
  'Adverts & marketing|Making adverts': w('Adverts are updated regularly.', 'Out-of-date offers on display.', 'Customers see our real services and prices.', 'Old adverts bring wrong expectations and lost trust.'),
  'Adverts & marketing|Accounts': w('Social accounts are used safely.', 'Staff with too much access.', 'Our pages stay under our control.', 'A lost or misused account loses our audience overnight.'),
  'Adverts & marketing|WhatsApp adverts': w('The daily WhatsApp advert goes out.', 'Days with no advert.', 'Regular reminders bring regular orders.', 'No advert, no reminder, fewer orders.'),
  'Adverts & marketing|Video adverts': w('Video adverts are made and kept current.', 'Weak or missing video presence.', 'Video reaches more people than text.', 'Without video, we lose reach to competitors who use it.'),
  // Display
  'Shop display & arrangement|Arrangement': w('Goods and designs are arranged well.', 'Messy or hidden products.', 'Customers see and buy more.', 'Poor display hides products, and hidden products do not sell.'),
  'Shop display & arrangement|Arranging goods': w('Goods are arranged in a fixed way.', 'Searching for stock.', 'Staff serve faster and count easier.', 'Time lost searching is time customers wait.'),
  'Shop display & arrangement|Customer display': w('The customer-facing display is neat and current.', 'Dusty, dated displays.', 'First impressions pull customers in.', 'A poor display tells customers we are not serious.'),
  'Shop display & arrangement|Storage': w('Stock is stored properly.', 'Damaged or lost goods.', 'Goods stay in good condition.', 'Damaged stock cannot be sold and is a direct loss.'),
  // Cleanliness
  'Cleanliness & safety|Daily cleaning': w('The shop is cleaned every day on time.', 'Dirt that damages paper and machines.', 'A clean shop looks professional and protects equipment.', 'Dust ruins prints and machines, and customers judge our work by our shop.'),
  'Cleanliness & safety|Closing clean-up': w('The shop is left clean and safe at closing.', 'Mess and hazards left overnight.', 'We open to a ready shop.', 'A messy start delays opening and costs sales.'),
  'Cleanliness & safety|Computers': w('Computers are cleared and kept tidy.', 'Customer files left on screen.', 'Privacy is kept and machines run fast.', 'Left-behind files leak customer information and slow the machines.'),
  'Cleanliness & safety|Weekly cleaning': w('A deeper clean is done weekly.', 'Build-up of dirt.', 'Machines last longer and break less.', 'Neglect means costly repairs.'),
  'Cleanliness & safety|Fire safety': w('Fire equipment is checked and everyone knows how to use it.', 'A fire with no way to fight it.', 'People and stock are protected.', 'A fire can end the business and put lives at risk.'),
  'Cleanliness & safety|Cables and power': w('Cables are safe and tidy.', 'Trip hazards and overloaded boards.', 'No electrical fires or injuries.', 'Bad cables cause fires, injuries and damaged equipment.'),
  'Cleanliness & safety|Front panel': w('The front panel stays clean and clear.', 'Food, drink and bags near equipment.', 'Equipment and customers\' work stay safe.', 'Spilled drink on a machine means a costly repair.'),
  // Equipment
  'Equipment, power & repairs|Power': w('Power is managed safely.', 'Sudden power loss and damage.', 'Work continues and machines are protected.', 'Power surges damage machines and lose unsaved work.'),
  'Equipment, power & repairs|Printers': w('Printers are checked and kept working.', 'Printers down when customers are waiting.', 'We can always serve printing orders.', 'A printer down is lost sales and unhappy customers.'),
  'Equipment, power & repairs|Repairs': w('Faults are reported and repaired quickly.', 'Small faults growing into big ones.', 'Equipment stays reliable.', 'Ignored faults become expensive breakdowns.'),
  'Equipment, power & repairs|Computers': w('Computers are looked after.', 'Slow, infected or broken machines.', 'Work is quick and safe.', 'Broken computers stop all work.'),
  'Equipment, power & repairs|Phones': w('Company phones are used properly.', 'Misuse or loss.', 'The business channel stays reliable.', 'A lost or misused phone loses customer contacts and accounts.'),
  'Equipment, power & repairs|Closing': w('Equipment is switched off and secured when closing.', 'Machines left on overnight.', 'Less risk of fire and theft.', 'Machines left on risk fire and wear.'),
  // Staff management
  'Staff management|Time and clocking': w('Everyone clocks in and out honestly.', 'Wrong or missing times.', 'Pay is fair and the shop is staffed when needed.', 'Wrong times mean wrong pay and an unstaffed shop.'),
  'Staff management|Attendance': w('Staff come on time and tell us if they cannot.', 'Surprise absences.', 'The shop opens and serves on time.', 'An absence without warning loses sales and overloads the team.'),
  'Staff management|Meetings': w('The team meets regularly.', 'Problems and ideas never shared.', 'Everyone works to the same plan.', 'Without meetings, the same mistakes repeat.'),
  'Staff management|Assessments': w('Staff are assessed fairly.', 'Weak performance unseen.', 'Good work is rewarded and gaps are trained.', 'Without assessment, standards drop.'),
  'Staff management|Behaviour': w('Staff behave professionally.', 'Rudeness and conflict.', 'A respectful team customers like.', 'Poor behaviour loses customers.'),
  'Staff management|Conduct': w('Staff follow the code of conduct.', 'Rule-breaking.', 'Fairness and order.', 'Rule-breaking left unchecked spreads.'),
  'Staff management|Dress code': w('Staff dress properly.', 'Untidy appearance.', 'The team looks professional and is recognised as staff.', 'Poor dress hurts the shop\'s image.'),
  'Staff management|Opening and closing': w('The shop opens and closes the same way every day.', 'Missed steps.', 'A reliable start and a safe finish.', 'A missed step means lost sales or a security risk.'),
  'Staff management|Rota': w('The rota is known and followed.', 'Confusion about who works when.', 'The shop is covered at busy times.', 'A gap in cover loses sales.'),
  'Staff management|Training': w('Staff are trained properly.', 'Staff doing jobs they were never shown.', 'Fewer mistakes, faster service.', 'Untrained staff make costly mistakes.'),
  'Staff management|Sanctions': w('Breaking the laws has a fair, known consequence.', 'Unfair or inconsistent punishment.', 'Everyone knows the rules and the cost of breaking them.', 'Without consequences, the laws are only advice and standards fall.'),
  // Security
  'Security & privacy|Accounts': w('Company accounts are protected.', 'Passwords changed or shared.', 'We keep control of our business accounts.', 'A lost account can mean losing customers and money.'),
  'Security & privacy|Customer data': w('Customer information is kept private.', 'Leaks of names, numbers and documents.', 'Customers trust us with their documents.', 'A leak loses trust and can bring legal trouble.'),
  'Security & privacy|Personal numbers': w('Personal numbers are never given out.', 'Staff numbers shared with customers.', 'Staff stay safe and customers use official channels.', 'Leaked numbers lose orders from the official line and put staff at risk.'),
  'Security & privacy|CCTV': w('CCTV is kept running and checked.', 'Gaps in recording.', 'Incidents can be proved.', 'No footage means no proof when something goes missing.'),
  'Security & privacy|Locking up': w('The shop is locked up properly.', 'Doors and gates left open.', 'Stock and cash are safe overnight.', 'An unlocked shop is a burglary waiting to happen.'),
  'Security & privacy|Unfortunate events': w('Incidents are recorded and reported.', 'Problems hidden.', 'We learn and prevent repeats.', 'Hidden incidents happen again, and bigger.'),
}

const BY_CAT: Record<string, Why> = {
  'Stock & records': w('Stock and sales records must be true.', 'Records that do not match the shelf and the till.', 'Right decisions on ordering, pricing and profit.', 'Wrong records mean hidden losses and bad decisions.'),
  'Finance': w('Money matters need strict care.', 'Mistakes and leaks in cash and bills.', 'The business knows where its money is.', 'Money errors are real losses.'),
  'Customers & WhatsApp': w('Customers are the business.', 'Lost contact and slow replies.', 'Repeat customers and more referrals.', 'Every lost customer is lost income.'),
  'Customer service': w('Service is why customers return.', 'Poor or inconsistent treatment.', 'Loyal customers and word of mouth.', 'Bad service sends customers to competitors.'),
  'Adverts & marketing': w('Customers cannot buy what they do not know about.', 'Weak visibility.', 'More walk-ins and orders.', 'No advertising, fewer customers.'),
  'Shop display & arrangement': w('How the shop looks decides what sells.', 'Messy displays.', 'Faster service and more sales.', 'Poor display hides sales.'),
  'Cleanliness & safety': w('A clean, safe shop protects people and equipment.', 'Dirt, fire and injury risks.', 'Machines last, staff are safe.', 'Accidents and breakdowns cost far more than prevention.'),
  'Equipment, power & repairs': w('Machines earn the money.', 'Breakdowns and downtime.', 'We can always serve.', 'Broken machines stop income.'),
  'Staff management': w('A well-run team is productive.', 'Confusion and poor conduct.', 'A reliable shop.', 'Weak management lowers everything.'),
  'Security & privacy': w('We hold customers\' documents and the owner\'s money.', 'Leaks and theft.', 'Trust and safety.', 'A breach loses trust and money.'),
}

export function whyFor(cat: string | null, sub: string | null): Why | null {
  return BY_SUB[`${cat}|${sub}`] ?? (cat ? BY_CAT[cat] ?? null : null)
}

// What each tile is for, shown once at the top of the tile.
const BY_AREA: Record<string, Why> = {
  items: w('Live Sale is where every sale is born.', 'Sales missed, taken at the wrong price or tapped to the wrong item.', 'Accurate stock, cash and profit every day.', 'A wrong tap is a wrong stock figure, and wrong stock becomes lost sales or hidden theft.'),
  log: w('The Sales Log proves what happened each day.', 'Days that do not reconcile.', 'Trusted daily figures and quick answers to customer queries.', 'Without a clean log, errors and shortages cannot be traced.'),
  customers: w('Customers are the business, and their details are our asset.', 'Lost contacts and slow replies.', 'Repeat business and referrals.', 'Every lost contact is a lost repeat sale.'),
  counts: w('Counts keep the app honest.', 'Stock the app says is there but is not.', 'Right reordering and early warning of loss.', 'Uncounted stock hides theft and waste.'),
  item360: w('One screen shows one item\'s whole story.', 'Guessing the cause of a loss.', 'Fast, correct fixes.', 'Wrong fixes leave the real problem.'),
  losses: w('Losses and slow sellers need watching.', 'Quiet leaks and tied-up cash.', 'Money is spent on what sells.', 'Unwatched leaks grow every week.'),
}
export const whyForArea = (key: string, cat: string): Why | null => BY_AREA[key] ?? BY_CAT[cat] ?? null
