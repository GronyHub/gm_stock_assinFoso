# Page guide videos ("how to use this page"), one per page. Shown by the ▶ Guide button and the first-visit
# notice (components/PageGuide.tsx). Rendered by render_guides.py into public/guides/<key>.mp4.
# Each scene: heading, steps on screen, words spoken.
END = dict(heading="That's it", bullets=["Play this guide again any time with ▶ Guide", "Not sure? Ask the manager before you guess"],
           say="That is all for this page. You can play this guide again any time with the Guide button. If you are not sure about something, ask the manager before you guess.")

GUIDES = {
 "sale": dict(title="Live Sale", colour=(20, 90, 60), scenes=[
   dict(heading="Live Sale", sub="Record every sale the moment it happens",
        say="This is Live Sale. Every sale in the shop is recorded here, the moment it happens. Here is how to use it."),
   dict(heading="1. Find the item", bullets=["Type its name in Search item", "Or use All and Groups to narrow the cards", "WIC: a sale to a customer", "GMC: the shop's own use, not a sale"],
        say="First, find the item. Type its name in Search item, or use All and Groups to narrow the cards. Keep the switch on W I C for a sale to a customer. G M C is only for things the shop uses itself, and it is not a sale."),
   dict(heading="2. Record the sale", bullets=["Tap the item card", "Check the quantity and the price", "Who: GM number, phone, name or a label", "A new phone number opens the customer form", "Save: it appears in the Sales Log"],
        say="Tap the item's card. Check the quantity and the price. In the Who box, type the customer's G M number, phone number or name. If you don't know them, type a short label, such as man in blue shirt. A new phone number opens the customer form, so you can register them. Then save. The sale appears in the Sales Log straight away."),
   dict(heading="3. Several items, one customer", bullets=["Tap MI", "Add each item to the basket", "Pick the customer", "Issue one receipt for all of them"],
        say="When one customer buys several items, tap M I. Add each item to the basket, pick the customer, and issue one receipt for everything."),
   dict(heading="4. Counts and mistakes", bullets=["COUNT NOW items: count them, type the number", "Wrong sale? Undo it in the Sales Log", "Never tap again to correct a sale"],
        say="When an item shows Count Now, count it on the shelf and type the number. If you record a sale by mistake, undo it in the Sales Log. Never tap it again to correct it, because that records a second sale."),
   END]),

 "log": dict(title="Sales Log", colour=(30, 60, 140), scenes=[
   dict(heading="Sales Log", sub="Every sale, every day, back to 2023",
        say="This is the Sales Log. It shows every sale, day by day, and the older records back to 2023."),
   dict(heading="1. The day row", bullets=["Green row: the day's total and profit", "+ CC: type the cash counted at closing", "WNW: cash counted minus sales", "Orange: more cash than sales written", "Red: cash is short"],
        say="Each day starts with a green row showing the day's total and profit. At closing, count the cash, tap plus C C and type the amount. W N W then shows the difference between the cash and the sales written down. Orange means more cash than sales recorded. Red means cash is short."),
   dict(heading="2. Each sale", bullets=["Customer, price, cost and profit", "Tick in WA: message sent on WhatsApp", "Receipt number: tap it to reprint", "REC rows: older records, read-only"],
        say="Under it, each sale shows the customer, price, cost and profit. A tick in W A means the WhatsApp message was sent. Tap a receipt number to view or reprint it. Grey rows marked R E C are older records, and they cannot be changed."),
   dict(heading="3. Fix a sale", bullets=["Clock button: change a sale's time or day", "Undo arrow: cancel a wrong sale", "Undone sales turn red: CANCELLED", "Pencil on the day row: edit an entry"],
        say="To fix a sale, tap the clock to change its time or day, or the undo arrow to cancel a wrong sale. A cancelled sale turns red and is crossed out. The pencil on the day row edits an entry."),
   dict(heading="4. Tools on the bar", bullets=["Receipt…: tick sales, make one receipt", "+ Past sale: a sale from an earlier day", "Period: pick a year and month", "W / G, Bars only, Flags and History", "Chart button: analytics, days and months"],
        say="On the bar: Receipt lets you tick sales and make one receipt. Plus Past sale records a sale from an earlier day. Period shows older months and years. W and G, Bars only, Flags and History filter the list. And the chart button opens analytics, with totals for every day and month."),
   END]),

 "bills": dict(title="Bills", colour=(120, 70, 20), scenes=[
   dict(heading="Bills", sub="Everything the shop buys",
        say="This is Bills. Every purchase the shop makes, from stock to supplies, is recorded here as a bill."),
   dict(heading="1. Record a bill", bullets=["Tick + New Bill", "Pick the vendor and the date", "Add each item: quantity and unit price", "Attach a photo of the receipt", "Save"],
        say="Tick plus New Bill. Pick the vendor and the date. Add each item with its quantity and unit price, attach a photo of the supplier's receipt, and save. The stock of those items goes up."),
   dict(heading="2. Find a bill", bullets=["Filter by vendor, month and year", "Bars only: just the bill totals", "History: every change made to bills", "Purchase Orders and Vendors are here too"],
        say="To find a bill, filter by vendor, month and year. Bars only shows just the bill totals. History lists every change made to bills. Purchase Orders and Vendors are reached from here too."),
   dict(heading="3. Keep bills complete", bullets=["Every bill has a vendor", "Every bill has an item list", "Every bill has its receipt attached", "Every bill has its related expense"],
        say="Keep every bill complete: a vendor, an item list, its receipt attached, and its related expense. The flags show any bill that is missing one of these, so it can be fixed."),
   END]),

 "expenses": dict(title="Expenses", colour=(130, 40, 40), scenes=[
   dict(heading="Expenses", sub="Money spent on running the shop",
        say="This is Expenses, for money spent on running the shop, such as transport, repairs, utilities and wages."),
   dict(heading="1. Record an expense", bullets=["Tap + New", "Pick the account (what it was for)", "Date, amount and a clear description", "Pick the vendor if there is one", "Save"],
        say="Tap plus New. Pick the account, which says what the money was for. Enter the date, the amount and a clear description, pick the vendor if there is one, and save."),
   dict(heading="2. Properties", bullets=["Spending on equipment: pick the property", "Mark it Working or Not Working", "Available or Not Available, and where it is"],
        say="When the money was spent on equipment, pick the property it was for. Mark whether it is working or not, and whether it is available, with its location."),
   dict(heading="3. Find and check", bullets=["Filter by account and type", "Search…: find by words", "Filter: views, history and analytics", "Flags show expenses to fix"],
        say="To find an expense, filter by account and type, or search by words. The Filter menu opens other views, history and analytics, and the flags show expenses that need fixing."),
   END]),

 "purchase_orders": dict(title="Purchase Orders", colour=(40, 90, 120), scenes=[
   dict(heading="Purchase Orders", sub="What we order from suppliers",
        say="This is Purchase Orders, for what we order from suppliers before the goods arrive."),
   dict(heading="1. Make an order", bullets=["Tap + New PO", "Pick the vendor, order date and delivery date", "Add each item: quantity and price", "Send on WhatsApp to the supplier"],
        say="Tap plus New P O. Pick the vendor, the order date and the expected delivery date. Add each item with its quantity and price, then send it to the supplier on WhatsApp."),
   dict(heading="2. When the goods arrive", bullets=["Open the order: Receive Items", "Type the quantity actually received", "Pick the date received", "Receiving History keeps every delivery"],
        say="When the goods arrive, open the order and tap Receive Items. Type the quantity you actually received and the date. Receiving History keeps every delivery."),
   dict(heading="3. Check against the bill", bullets=["Check vs Bills: order vs supplier's bill", "Same or Different, item by item", "Copy report / send differences to the supplier", "Mark as reported"],
        say="Then use Check versus Bills to compare the order with the supplier's bill, item by item. Copy or send the differences to the supplier, and mark them as reported."),
   END]),

 "vendors": dict(title="Vendors", colour=(90, 60, 20), scenes=[
   dict(heading="Vendors", sub="The suppliers we buy from",
        say="This is Vendors, the list of suppliers we buy from."),
   dict(heading="1. Add a vendor", bullets=["Tap + New Vendor", "Name, contact number and location", "Save"],
        say="To add a supplier, tap plus New Vendor. Enter their name, contact number and location, and save."),
   dict(heading="2. Find and check", bullets=["Search vendors by name", "Tap a vendor: their bills and payments", "Billed, paid and outstanding", "No contact flag: vendors to complete"],
        say="Search by name, and tap a vendor to see their bills, payments, and how much is still outstanding. The red flag button lists vendors with no contact number or location, so you can complete them."),
   END]),

 "customers": dict(title="Customers", colour=(150, 40, 100), scenes=[
   dict(heading="Customers", sub="Everyone who buys from us",
        say="This is Customers, everyone who buys from us, each with a G M number."),
   dict(heading="1. New customers", bullets=["Register them while selling in Live Sale", "Type a new phone number in the Who box", "The customer form opens: fill it and save"],
        say="New customers are registered while you sell. In Live Sale, type their phone number in the Who box. When the number is new, the customer form opens. Fill it in and save."),
   dict(heading="2. Find a customer", bullets=["Search by name, phone or GM number", "Flags: missing location, contact or email", "Location: customers from one place", "Columns: choose what the table shows"],
        say="Search by name, phone or G M number. Use Flags to find customers missing a location, contact or email, and Location to list customers from one place. Columns chooses what the table shows."),
   dict(heading="3. A customer's details", bullets=["Tap a customer to open their details", "Edit their phone, location and notes", "Their receipts: View / print any of them"],
        say="Tap a customer to open their details. You can edit their phone, location and notes, and see all their receipts. View or print any receipt from there."),
   END]),

 "counts": dict(title="Counts", colour=(60, 60, 130), scenes=[
   dict(heading="Counts", sub="Checking the stock on the shelves",
        say="This is Counts, where stock counts are recorded, to check that what is on the shelf matches the records."),
   dict(heading="1. Record a count", bullets=["Tap + Manual Count", "Pick the item", "Count it on the shelf, type the number", "Save"],
        say="To record a count, tap plus Manual Count. Pick the item, count it on the shelf, type the number, and save."),
   dict(heading="2. Read the results", bullets=["Each count: expected vs counted", "Positive difference: a loss", "Negative difference: a gain", "A loss is explained to the manager"],
        say="Each count shows what the records expected and what was counted. A positive difference is a loss, and a negative one is a gain. Any loss must be explained to the manager."),
   dict(heading="3. History and analytics", bullets=["History: every count ever made", "Analytics: losses and gains over time", "Columns: choose what the table shows"],
        say="History lists every count ever made, and Analytics shows losses and gains over time."),
   END]),

 "item360": dict(title="Item 360", colour=(20, 100, 110), scenes=[
   dict(heading="Item 360", sub="Everything about one item",
        say="This is Item 360. It shows everything about one item in one place."),
   dict(heading="1. Find the item", bullets=["Type its name or group in the search", "Tap it in the results"],
        say="Type the item's name or group in the search, and tap it in the results."),
   dict(heading="2. What you see", bullets=["Stock on hand and its group", "Selling price and cost price", "Every sale, bill and count, day by day", "The item's photo"],
        say="You see its stock on hand and group, its selling and cost price, and every sale, bill and count, day by day, with the item's photo. Use it to answer any question about an item before you guess."),
   END]),

 "pl": dict(title="P&L", colour=(30, 110, 60), scenes=[
   dict(heading="Profit & Loss", sub="Did the shop make money?",
        say="This is Profit and Loss. It shows whether the shop made money, day by day."),
   dict(heading="1. Each day", bullets=["Sales, bills and expenses", "Cash out total", "Daily loss from counts", "P/L: profit or loss for the day"],
        say="Each day shows the sales, the bills and expenses paid, the total cash out, and the day's stock losses. The last column is the profit or loss for the day."),
   dict(heading="2. Losses", bullets=["Loss by Date and Loss by Items", "Net Loss", "Items priced at or below cost"],
        say="The loss pages under P and L show losses by date and by item, the net loss, and items priced at or below their cost. These are the first things to fix."),
   END]),

 "cab": dict(title="CAB (Cash at Bank)", colour=(40, 80, 150), scenes=[
   dict(heading="CAB", sub="Cash at bank, week by week",
        say="This is C A B, cash at bank. It checks, week by week, that the money we should have matches the money we really have."),
   dict(heading="1. Each week", bullets=["Bank, MoMo and physical cash", "Debtors: money owed to us", "Money in and money out", "Week-end balance and running total"],
        say="Each week shows the bank balance, the MoMo balance, the physical cash, and money owed to us, with money in and out, the week-end balance and the running total."),
   dict(heading="2. Confirm the week", bullets=["Tap + New CAB Confirm", "Count the physical cash, check bank and MoMo", "Enter the real amounts", "Diff: what doesn't match", "NOT CONFIRMED weeks still need checking"],
        say="At the end of the week, tap New C A B Confirm. Count the physical cash and check the bank and MoMo balances, then enter the real amounts. Diff shows anything that does not match. Weeks marked not confirmed still need checking."),
   END]),
}
