'use client'

import { useMemo, useState, type ReactNode } from 'react'

/* -- tiny visual aids -- recreate the real colors/icons/labels used on the
   actual page, without depending on live data (this modal has none) -- */
function MiniBanner({ text, bg }: { text: string; bg: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold text-white tracking-wide ${bg}`}>
      {text}
    </span>
  )
}
function MiniPill({ text, tone = 'gray' }: { text: string; tone?: 'blue' | 'gray' | 'indigo' }) {
  const cls = tone === 'blue' ? 'bg-blue-600 text-white' : tone === 'indigo' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{text}</span>
}
function MiniIconBtn({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'purple' | 'red' }) {
  const cls = tone === 'blue' ? 'bg-blue-600 text-white' : tone === 'purple' ? 'bg-purple-600 text-white' : tone === 'red' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cls}`}>{children}</span>
}
function Callout({ kind = 'tip', children }: { kind?: 'tip' | 'warn'; children: ReactNode }) {
  const cls = kind === 'warn' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'
  return <p className={`text-xs rounded-lg border px-3 py-2 ${cls}`}>{children}</p>
}
function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-1.5 list-decimal list-inside marker:font-bold marker:text-gray-400">
      {items.map((it, i) => <li key={i} className="text-sm text-gray-700">{it}</li>)}
    </ol>
  )
}

type Topic = { id: string; title: string; group: string; keywords: string; body: ReactNode }

const TOPICS: Topic[] = [
  {
    id: 'overview',
    title: 'What is Live Sale, and what do the tabs do?',
    group: 'Overview',
    keywords: 'overview tabs switch live log sales bills count mode',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Live Sale is where every walk-in sale, GMC (internal-use) take, count, and bill gets recorded, one item at a time, as it happens -- instead of writing a receipt out at the end of the day.</p>
        <p className="text-sm text-gray-700">The row of pills at the top switches between five views. They all work on the same underlying data, just filtered/arranged differently:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { p: 'Live', d: 'The tap-to-sell grid -- the main screen you spend most of your time on.' },
            { p: 'Log', d: 'Every tap you have made today and on past days, in one history.' },
            { p: 'Sales', d: 'The classic list of daily sales receipts.' },
            { p: 'Bills', d: 'Purchases/restocks recorded as bills, plus a New Bill form.' },
            { p: 'Count', d: 'Everything about stock counts: what is due, past records, and history.' },
          ].map(r => (
            <div key={r.p} className="border border-gray-200 rounded-lg p-2">
              <MiniPill text={r.p} tone={r.p === 'Live' ? 'blue' : 'gray'} />
              <p className="text-[11px] text-gray-500 mt-1">{r.d}</p>
            </div>
          ))}
        </div>
        <Callout>On a phone, this row scrolls sideways rather than wrapping -- swipe it if a tab looks cut off.</Callout>
      </div>
    ),
  },
  {
    id: 'tapping-a-sale',
    title: 'How to record a walk-in sale',
    group: 'Live tab',
    keywords: 'tap sale record wic quantity price sell customer',
    body: (
      <div className="space-y-3">
        <Steps items={[
          <>Find the item in the grid (use the search box or the type/group filters if the list is long).</>,
          <>Tap its <MiniIconBtn tone="blue">+</MiniIconBtn> button. A sheet opens with the item name, selling price, cost price, and current stock.</>,
          <>Enter the quantity sold. If the item has a custom selling price for this sale, you can override the price too.</>,
          <>Confirm. The tap is recorded immediately and rolls into today sales receipt.</>,
        ]} />
        <p className="text-sm text-gray-700">Every walk-in sale you tap this way lands on <strong>one combined receipt for the day</strong> -- you don't need to open a separate receipt per customer.</p>
      </div>
    ),
  },
  {
    id: 'wic-vs-gmc',
    title: 'What does the WIC / GMC switch mean?',
    group: 'Live tab',
    keywords: 'wic gmc internal use grony multimedia toggle switch customer',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Next to the search box is a toggle button showing <MiniPill text="WIC" tone="blue" /> or <MiniPill text="GMC" tone="indigo" />:</p>
        <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
          <li><strong>WIC</strong> (Walk-In Customer) -- the normal mode. Every tap here is a real sale, counted in revenue.</li>
          <li><strong>GMC</strong> (Grony Multimedia as Customer) -- for stock the shop takes for its <strong>own internal use</strong>, not a real sale. It is excluded from revenue and profit, and it is how the system explains stock that left the shelf without a walk-in sale (e.g. taking a pack of paper to print in-house). Tapping this shows a loud red warning banner across the top the whole time GMC is selected, precisely so it is hard to leave on by accident.</li>
        </ul>
        <Callout kind="warn">Only use GMC for genuine internal use. A GMC tap that should have been a real sale under-reports revenue; a real sale tapped as GMC does the same in reverse.</Callout>
        <p className="text-sm text-gray-700">While GMC is selected, the grid also only shows items that already have some GMC history -- a brand-new item can not be GMC-taken for the very first time from here (it needs a normal restock/bill first).</p>
      </div>
    ),
  },
  {
    id: 'custom-quantity',
    title: 'Selling a quantity that is not a preset button',
    group: 'Live tab',
    keywords: 'custom quantity amount preset number type',
    body: (
      <p className="text-sm text-gray-700">Every tap sheet has a plain quantity field -- type any number, it does not have to match a suggested amount. There is no separate "custom" mode; you always type the exact quantity being sold.</p>
    ),
  },
  {
    id: 'undo-a-tap',
    title: 'How to undo a tap (fix a mistake)',
    group: 'Live tab',
    keywords: 'undo mistake wrong tap delete remove cancel',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Tapped the wrong item, or the wrong quantity? Go to the <MiniPill text="Log" /> tab, find the tap in today list, and undo it there.</p>
        <Callout>Undoing does not delete history -- the tap stays visible in the Log, just crossed out and excluded from the day total, so there is always a record of what was corrected and when.</Callout>
      </div>
    ),
  },
  {
    id: 'count-now-banner',
    title: 'What does the "COUNT NOW" banner mean?',
    group: 'Live tab',
    keywords: 'count now due overdue banner amber red pinned top expected',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Items overdue for a physical stock count are pinned to the top of the grid with a colored strip across the card:</p>
        <div className="space-y-2">
          <div><MiniBanner text="⚠ COUNT NOW - Today" bg="bg-amber-500" /> <span className="text-xs text-gray-500 ml-2">Amber = due, but not overdue yet.</span></div>
          <div><MiniBanner text="⚠ COUNT NOW - 3d OVERDUE" bg="bg-red-600" /> <span className="text-xs text-gray-500 ml-2">Red = overdue -- count it as soon as possible.</span></div>
        </div>
        <p className="text-sm text-gray-700">Tap the item and a count field appears right inside the sale sheet -- you do not need to switch to the Count tab to clear it. Enter what is actually on the shelf and submit; the item drops off this list once it is counted.</p>
      </div>
    ),
  },
  {
    id: 'count-guard',
    title: 'Why is a sale or bill being blocked?',
    group: 'Live tab',
    keywords: 'blocked cannot record error guard needs counted overdue prevent',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">If an item is overdue for a count, the system will refuse to record a new sale, live tap, or bill against it until it is counted. This is deliberate: letting transactions pile up on stale stock numbers is exactly how stock records quietly drift away from what is really on the shelf.</p>
        <p className="text-sm text-gray-700">The fix is always the same: count the item first (see "COUNT NOW banner" above), then try the transaction again.</p>
        <Callout>Purchase Orders are not blocked by this -- restocking an item is allowed even if it is overdue for a count.</Callout>
      </div>
    ),
  },
  {
    id: 'attention-banners',
    title: 'What do the colored warning banners mean, and how do I clear them?',
    group: 'Live tab',
    keywords: 'negative stock duplicate service violation unlinked sale missing price cost group banner warning flag fix solve resolve merge link edit save tap click where',
    body: (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">Besides count-due, an item can carry its own data-integrity warning. Only the single most serious one shows on the card (plus a "+N more" if there is more than one) -- worst first. Each one below has the exact taps to clear it.</p>

        <Callout kind="warn">Tapping one of these flags in the current view flags panel only <strong>narrows the grid</strong> down to the affected items -- it does not open anything to fix. For Duplicate/Unlinked/Service Violation, switch to the Items view (in the same page) to reach the fix buttons.</Callout>

        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap gap-1">
              <MiniBanner text="⚠ MISSING SELLING PRICE" bg="bg-orange-600" />
              <MiniBanner text="⚠ MISSING COST PRICE" bg="bg-orange-500" />
              <MiniBanner text="⚠ MISSING GROUP" bg="bg-amber-500" />
            </div>
            <p className="text-xs text-gray-600 mt-1">No selling price / cost price / group set on the item.</p>
            <p className="text-sm text-gray-800 mt-1"><strong>Fix it:</strong></p>
            <Steps items={[
              <>Tap the item <MiniIconBtn tone="blue">+</MiniIconBtn> button to open its sheet.</>,
              <>Tap <strong>Edit</strong>.</>,
              <>Fill in the empty <strong>Selling price</strong> / <strong>Cost price</strong> field, or pick/type a <strong>Group</strong>.</>,
              <>Tap <strong>Save</strong>. The banner clears immediately.</>,
            ]} />
          </div>

          <div>
            <MiniBanner text="⚠ NEGATIVE STOCK" bg="bg-red-600" />
            <p className="text-xs text-gray-600 mt-1">Stock on hand has gone below zero -- a bill, GMC record, or count is missing somewhere.</p>
            <p className="text-sm text-gray-800 mt-1"><strong>Fix it:</strong></p>
            <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
              <li>If the item also shows <strong>COUNT NOW</strong>, count it -- tap it, enter what is really on the shelf, and submit. That alone corrects the number.</li>
              <li>If it is not due for a count, the real cause is almost always a restock that was never entered -- check the <strong>Bills</strong> tab for a missing purchase, or add one, before the number will make sense again.</li>
            </ul>
          </div>

          <div>
            <MiniBanner text="⚠ DUPLICATE ITEM" bg="bg-red-600" />
            <p className="text-xs text-gray-600 mt-1">This item looks like the same product entered twice under a slightly different name.</p>
            <p className="text-sm text-gray-800 mt-1"><strong>Fix it:</strong></p>
            <Steps items={[
              <>Switch to the <strong>Items</strong> view.</>,
              <>Open the flags panel (📜) and tap the <strong>Duplicate Items</strong> pill.</>,
              <>Each pair shows both names side by side with two buttons: <strong>Keep "Name A"</strong> or <strong>Keep "Name B"</strong> -- tap whichever one you want to keep. The other full history (sales, bills, counts) merges into it automatically.</>,
              <>If they are genuinely two different products, tap <strong>Different -- Not a Duplicate</strong> instead, so it stops being flagged.</>,
            ]} />
          </div>

          <div>
            <MiniBanner text="⚠ UNLINKED SALE" bg="bg-orange-600" />
            <p className="text-xs text-gray-600 mt-1">A past sale line matches this item by name but was never actually linked to it.</p>
            <p className="text-sm text-gray-800 mt-1"><strong>Fix it:</strong></p>
            <Steps items={[
              <>Switch to the <strong>Items</strong> view, open the flags panel (📜), and tap <strong>Unlinked Sales</strong>.</>,
              <>Each row shows how many sale lines matched this item and a button reading <strong>"Link N sale(s) to this item"</strong> -- tap it to connect them all at once.</>,
            ]} />
          </div>

          <div>
            <MiniBanner text="⚠ SERVICE VIOLATION" bg="bg-rose-600" />
            <p className="text-xs text-gray-600 mt-1">A service item (no physical stock) shows GMC use, a bill, or a stock count against it.</p>
            <p className="text-sm text-gray-800 mt-1"><strong>Fix it:</strong></p>
            <Steps items={[
              <>Switch to the <strong>Items</strong> view, open the flags panel (📜), and tap <strong>Service Violations</strong> to see which services are affected and what data they are carrying.</>,
              <>Tap the <strong>⚙️ Service GMC</strong> button near the top to open the Service GMC actions dropdown.</>,
              <>Use one of these actions:
                <ul className="list-disc list-inside ml-2 text-sm">
                  <li><strong>Migrate Data</strong> -- transfers counts, bills, and sales from services to their target GMC items (if configured).</li>
                  <li><strong>Fix Loss Records</strong> -- moves the audit trail of deletions from services to their target items.</li>
                  <li><strong>Clear Cost Prices</strong> -- removes cost prices from services (owner-level only).</li>
                  <li><strong>Add Constraints</strong> -- enforces database rules to prevent new violations (owner-level only).</li>
                </ul>
              </>,
              <>If the service does not have a target GMC item, track down the wrongly-logged bill, count, or GMC entry (in Bills, Count Records, or the Log) and correct or delete it there.</>,
            ]} />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'pack-items-gmc-only',
    title: 'Pack items and GMC-only conversions',
    group: 'Item settings',
    keywords: 'pack item gmc only conversion single units photo paper ream',
    body: (
      <div className="space-y-4">
        <p className="text-sm text-gray-700"><strong>Pack items</strong> are items sold as a container of smaller units (e.g. a ream of photo paper, a case of pens). When you set up a pack item, you configure how many singles it contains, and what the single-unit item is called.</p>

        <div className="space-y-2">
          <p className="text-sm text-gray-700"><strong>How pack conversions work:</strong></p>
          <Steps items={[
            <>You buy a pack (e.g. 1 ream of photo paper). The pack stock goes +1.</>,
            <>You GMC the pack -- the system knows a pack always converts to its singles, so it automatically credits the singles item instead (e.g. +500 sheets of photo paper). The pack stock goes back to -1 (undo the purchase), and the singles inventory grows.</>,
            <>You can now sell the singles individually without ever buying a pack per sale -- the inventory is already there, and GMC-ing the pack was how it got there.</>,
          ]} />
        </div>

        <Callout>
          <strong>Example:</strong> Photo paper ream (pack) <strong>converts to</strong> 500 sheets (singles). Buy a ream → GMC the ream → 500 sheets are credited automatically. Sell sheets one at a time; never need to buy another ream until inventory runs out.
        </Callout>

        <div className="space-y-2">
          <p className="text-sm text-gray-700"><strong>GMC-only items:</strong></p>
          <p className="text-sm text-gray-700">Some items are marked as "GMC only, no service" -- these can <strong>never</strong> be bought directly, and can only exist in stock as credits from pack conversions. Examples: individual sheets that come from a ream, individual pieces from a bulk pack.</p>
          <p className="text-sm text-gray-700">If you try to GMC one of these items directly (or buy one in a bill), the system blocks it and tells you to GMC the pack instead.</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-700"><strong>Why this matters:</strong></p>
          <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
            <li>It prevents inventory chaos -- GMC-only items <strong>must</strong> flow through their pack conversion, keeping stock numbers consistent and traceable.</li>
            <li>Pack conversions are the single source of truth for how many singles came in.</li>
            <li>If stock of a singles item does not add up, look at the pack GMC history to find where they came from (or did not).</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'item-filter',
    title: 'Using the item filter (Loss / Gain / Low SOH / count cadence)',
    group: 'Live tab',
    keywords: 'filter dropdown loss gain soh stock daily every days dormant not counted find',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">The <strong>Filter</strong> dropdown narrows the grid down to items that need attention, without leaving Live Sale:</p>
        <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li><strong>Loss / Gain</strong> -- items whose last count came up short or over.</li>
          <li><strong>Low SOH</strong> -- items sitting at zero or negative stock.</li>
          <li><strong>Daily, Every 3d/7d/15d/30d/45d, Dormant, Not counted</strong> -- one option per count cadence actually in use, so you can jump straight to "everything due every 15 days" and so on.</li>
        </ul>
        <p className="text-sm text-gray-700">Pick <strong>Filter: All items</strong> to clear it.</p>
      </div>
    ),
  },
  {
    id: 'type-group-filter',
    title: 'The type and group filters',
    group: 'Live tab',
    keywords: 'type goods services group filter narrow',
    body: (
      <p className="text-sm text-gray-700"><strong>All types / Goods / Services</strong> narrows the grid to physical stock items or service items only. <strong>All groups</strong> narrows it to one category (e.g. "Stationery", "Printing") -- useful once the catalogue gets long.</p>
    ),
  },
  {
    id: 'search-pick-item',
    title: 'Searching for and picking a specific item',
    group: 'Live tab',
    keywords: 'search find pick item box magnifying',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Type into the search box to jump straight to an item by name. Selecting a result from the dropdown pins the grid to show <strong>only</strong> that item -- handy on a small screen, or when you already know exactly what you are looking for.</p>
        <p className="text-sm text-gray-700">Clear the picked item with the <MiniIconBtn tone="blue">✕</MiniIconBtn> button next to the search box to go back to the full grid.</p>
      </div>
    ),
  },
  {
    id: 'edit-item',
    title: 'How to edit an item details',
    group: 'Item settings',
    keywords: 'edit item name price cost group unit conversion save change',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Tap an item to open its sheet, then <strong>Edit</strong>. From there you can change:</p>
        <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li><strong>Item name</strong> and <strong>Group</strong> (pick an existing group or type a new one).</li>
          <li><strong>Selling price</strong> and <strong>Cost price</strong>.</li>
          <li><strong>Units per pack</strong> and <strong>Unit name</strong> -- for items sold as packs of smaller units (e.g. a pack of photo paper).</li>
          <li>What this item <strong>converts to</strong> -- for a pack item, GMC-ing it credits its singles item; for a service, selling it deducts from the goods item it consumes.</li>
          <li><strong>Count settings</strong> (see "Changing how often an item is counted" and "Excluding an item from counts" below).</li>
        </ul>
        <p className="text-sm text-gray-700">Save applies immediately -- you do not need to leave the sheet.</p>
        <Callout>Deleting an item entirely is not done from Live Sale -- that lives on the Items page, and only works once the item has no sales/bills/count history (otherwise it needs to be merged into another item instead).</Callout>
      </div>
    ),
  },
  {
    id: 'count-cadence',
    title: 'Changing how often an item is counted',
    group: 'Item settings',
    keywords: 'count every days cadence daily automatic 3 7 15 30 45 interval frequency',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">In the item Edit sheet, under Stock counts, the <strong>Count every</strong> dropdown sets how often this specific item should be counted:</p>
        <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li><strong>Automatic</strong> (default) -- the system decides based on the item own history (sold via GMC → every 7 days; otherwise every 15 or 30 days depending on how steady its counts have been).</li>
          <li><strong>Daily, Every 3/7/15/30/45 Days</strong> -- a fixed cadence you choose.</li>
          <li><strong>Other...</strong> -- type any other number of days.</li>
        </ul>
        <p className="text-sm text-gray-700">The "Currently: ..." line above the dropdown shows what the item is actually resolving to right now, so you can tell whether it is already doing what you want before changing anything.</p>
      </div>
    ),
  },
  {
    id: 'exclude-from-counts',
    title: 'Excluding an item from counts entirely',
    group: 'Item settings',
    keywords: 'exclude count stop discontinued reason zero stock never',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">For stock that is genuinely gone for good (discontinued, off the market), tick <strong>Exclude from counts entirely</strong> in the item Edit sheet. You will need to give a reason (pick one, or choose "Other..." to type your own).</p>
        <Callout kind="warn">This only takes effect once the item stock is at exactly 0 -- if it still shows stock, bring it to zero first (a count, or a sale/bill that clears it out), then exclude it. This stops an item that still has real stock on the shelf from silently disappearing from every count queue.</Callout>
      </div>
    ),
  },
  {
    id: 'log-tab',
    title: 'The Log tab',
    group: 'Other tabs',
    keywords: 'log history taps today past days list',
    body: (
      <p className="text-sm text-gray-700">Shows every tap you have made, grouped by date, most recent day first. Use it to double-check today sales against your cash total, review a past day, or undo a tap that was not caught right away.</p>
    ),
  },
  {
    id: 'sales-tab',
    title: 'The Sales tab',
    group: 'Other tabs',
    keywords: 'sales receipts list classic customer named',
    body: <p className="text-sm text-gray-700">The classic list of sales receipts -- useful for named-customer sales that do not belong on the walk-in tap grid.</p>,
  },
  {
    id: 'bills-tab',
    title: 'The Bills tab',
    group: 'Other tabs',
    keywords: 'bills purchase restock new bill vendor',
    body: <p className="text-sm text-gray-700">Lists recorded bills (restocks/purchases) and includes a New Bill form. A bill is what brings stock back onto the shelf and is one of the records the count-reconciliation math checks against.</p>,
  },
  {
    id: 'count-tab-overview',
    title: 'The Count tab: interval buckets',
    group: 'Count tab',
    keywords: 'count tab daily every dormant not counted bucket list',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">The row of pill buttons at the top of the Count tab (Daily, Every 3d/7d/15d/30d/45d, Dormant, Not counted) each show the plain list of items on that cadence -- no due/overdue urgency here, just "which items are on which schedule."</p>
        <p className="text-sm text-gray-700"><strong>Dormant</strong> means an item last two counts both came back at zero with no bill since -- it is dropped out of the regular count rotation until a new bill brings stock back in, so it does not keep nagging for a count of nothing.</p>
      </div>
    ),
  },
  {
    id: 'count-records',
    title: 'Count Records: the full count history',
    group: 'Count tab',
    keywords: 'count records history table time expected loss gain edit delete columns',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">This is the Count tab landing view -- every count ever entered, newest day first, with: Item, Group, Qty counted, <strong>Exp</strong> (what the records expected), <strong>Loss/Gain</strong> (the difference -- red for a loss, amber for a gain), Time, who counted it (By), Source, and Notes.</p>
        <p className="text-sm text-gray-700">Use <strong>Edit</strong> on a row to correct a mistyped quantity or note. <strong>Del</strong> (where visible -- owner-level only) removes a count record entirely.</p>
        <Callout>This table doubles as the old "Loss by Date" feed -- use the All/Losses/Gains filter and the search box above it to narrow down to just the discrepancies, and the period-summary strip (All-Time/Yesterday/Week/Month/Year) for a quick loss total at a glance.</Callout>
      </div>
    ),
  },
  {
    id: 'count-history',
    title: 'Count History',
    group: 'Count tab',
    keywords: 'count history audit log who edited deleted',
    body: <p className="text-sm text-gray-700">The audit log of count-related actions -- who counted, edited, or deleted what, and when. Use this to trace back a change that does not match what you expected in Count Records.</p>,
  },
  {
    id: 'analytics',
    title: 'The Analytics button',
    group: 'Everywhere',
    keywords: 'analytics chart graph trend button icon',
    body: <p className="text-sm text-gray-700">Swaps the current list for charts/trends built from the same data -- shows up on Live, Log, Sales, Bills, and Count Records. Tap it again to go back to the normal list.</p>,
  },
  {
    id: 'laws-flags',
    title: 'The flags/laws icon',
    group: 'Everywhere',
    keywords: 'laws flags rules violations panel scale icon',
    body: <p className="text-sm text-gray-700">Opens a panel of standing flags/rules and outstanding violations relevant to whichever tab you are on (e.g. items with negative stock, missing prices) -- a running checklist rather than a one-off popup.</p>,
  },
  {
    id: 'large-screen',
    title: 'Large screen mode',
    group: 'Everywhere',
    keywords: 'large screen expand full exit close button',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">The <MiniIconBtn>⤢</MiniIconBtn> button expands Live Sale to fill the whole screen, hiding the surrounding page -- useful on a small window. A small floating <MiniIconBtn tone="red">✕</MiniIconBtn> button appears in the top-right corner while expanded; tap it to exit back to the normal layout.</p>
      </div>
    ),
  },
  {
    id: 'data-delay',
    title: 'Why do some numbers take a while to update?',
    group: 'Good to Know',
    keywords: 'slow delay refresh update stale cache wait hours cost data not updating frozen stuck',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">To keep the app affordable to run, some screens now show data that can be <strong>up to 2 hours old</strong> instead of updating the instant something changes. This was done deliberately -- it does not mean something is broken.</p>

        <div className="space-y-2">
          <p className="text-sm text-gray-800 font-semibold">Always instant, no matter what:</p>
          <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
            <li>Tapping a sale</li>
            <li>Recording a stock count</li>
            <li>Editing an item</li>
            <li>The "COUNT NOW" list you actually work through -- it shrinks in real time as you count, even though the badge below might not</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-800 font-semibold">Can lag up to 2 hours:</p>
          <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
            <li>Loss summaries</li>
            <li>Count Records list</li>
            <li>Overdue / 7-day / daily count badges (the small numbers, not the actual work list)</li>
            <li>Personal ledger</li>
            <li>Items list, groups filter</li>
            <li>Bills, Sales, Purchase Orders, Expenses lists</li>
          </ul>
        </div>

        <Callout>If a number looks off, it is most likely just waiting for its next refresh -- nothing was lost, and what you entered is already safely saved. Refreshing the page will not speed it up (the delay is on the server, not your device). If it still looks wrong after a couple of hours, tell a manager.</Callout>
      </div>
    ),
  },
  {
    id: 'glossary',
    title: 'Glossary: SOH, SP, CP, WIC, GMC, Expected, and more',
    group: 'Glossary',
    keywords: 'glossary meaning terms soh sp cp wic gmc expected soh definitions abbreviations',
    body: (
      <div className="space-y-1.5">
        {[
          ['SOH', 'Stock On Hand -- how much of this item the records say should be on the shelf right now.'],
          ['SP', 'Selling Price -- what a customer pays for one unit.'],
          ['CP', 'Cost Price -- what the shop paid for one unit; used to calculate margin.'],
          ['WIC', 'Walk-In Customer -- a normal, real sale.'],
          ['GMC', 'Grony Multimedia as Customer -- stock taken for the shop own internal use, not a real sale.'],
          ['Expected', 'What the records say should be on the shelf on a given day: the last count, plus bills/GMC-ins, minus sales/service use, all added up since that count.'],
          ['Loss / Gain', 'The difference between Expected and what was actually counted -- a loss when less was found than expected, a gain when more was.'],
          ['Dormant', 'An item whose last two counts were both zero with no bill since -- paused from the count rotation until restocked.'],
          ['Count cadence', 'How often an item is due for a count -- Daily, Every N days, or Automatic (system-decided).'],
        ].map(([t, d]) => (
          <div key={t} className="flex gap-2 text-sm">
            <span className="font-bold text-gray-900 w-16 shrink-0">{t}</span>
            <span className="text-gray-600">{d}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'local-dev-setup',
    title: 'Running Claude Code locally on your computer',
    group: 'Development Setup',
    keywords: 'local computer setup development claude code run npm dev',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">Running the app on your local computer (instead of using the cloud/remote environment) gives you full database access and avoids network policy restrictions.</p>
        <Steps items={[
          <>Clone or pull the latest code from the repository.</>,
          <>Make sure you have Node.js and npm installed on your computer.</>,
          <>Open a terminal in the project directory and run <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">npm install</code> to install dependencies.</>,
          <>Start the development server with <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">npm run dev</code>.</>,
          <>Open <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">http://localhost:3000</code> in your browser.</>,
        ]} />
        <Callout>Your local setup should have direct access to the Neon database and all features should work instantly.</Callout>
      </div>
    ),
  },
  {
    id: 'remote-vs-local',
    title: 'Cloud (remote) vs local development environments',
    group: 'Development Setup',
    keywords: 'remote cloud local environment network access database restriction',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">This app can run in two ways:</p>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Cloud/Remote (claude.ai/code)</p>
            <p className="text-xs text-gray-600">Runs in a managed container on Anthropic infrastructure. Useful for quick edits but subject to network policies that may restrict database access. If you see "Host not in allowlist" errors, your cloud environment network policy is blocking access to the database.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Local (your computer)</p>
            <p className="text-xs text-gray-600">Runs directly on your machine with direct access to all resources. No network restrictions, full database connectivity. Best for testing features that depend on data being available.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700">If database features are not working in the cloud, try running locally on your computer instead.</p>
      </div>
    ),
  },
  {
    id: 'database-connection',
    title: 'Database access and connection issues',
    group: 'Development Setup',
    keywords: 'database neon connection network policy error allowlist access denied',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">The app stores all data in a Neon PostgreSQL database. If features are not loading data, it is usually a database connection issue.</p>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Common error: "Host not in allowlist"</p>
          <p className="text-xs text-gray-600">This means your environment network policy is blocking access to the Neon database server. Solutions:</p>
          <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
            <li>Run the app <strong>locally on your computer</strong> -- it will have direct database access.</li>
            <li>If using the cloud environment, check your environment settings and whitelist the Neon host <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">api.c-3.us-east-1.aws.neon.tech</code>.</li>
          </ul>
        </div>
        <Callout kind="warn">When the database connection fails, many features will show empty results or will not load at all. Check the browser console (F12) and the dev server logs for error messages.</Callout>
      </div>
    ),
  },
  {
    id: 'filters-not-working',
    title: 'Bills filter options showing same results',
    group: 'Troubleshooting',
    keywords: 'bills filter all gmc vendor same results fix',
    body: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">If the Bills tab filter radio buttons (All / GMC Only / Vendor Only) all show the same results, it is likely one of these issues:</p>
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          <li><strong>Database connection is broken.</strong> Check if all bills disappeared or data is not loading -- see the "Database access and connection issues" section above.</li>
          <li><strong>In-memory cache is stale.</strong> Restart the dev server (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">npm run dev</code>) and hard-refresh your browser (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac).</li>
          <li><strong>Bills actually do not exist.</strong> Verify in your Neon database console that bills are present.</li>
        </ol>
        <p className="text-sm text-gray-700 mt-2">The filter logic was recently fixed -- make sure you have the latest code pulled from the repository.</p>
      </div>
    ),
  },
]

export function TrainingGuideModal({ isOpen, onClose }: {
  isOpen: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TOPICS
    return TOPICS.filter(t => t.title.toLowerCase().includes(q) || t.keywords.includes(q) || t.group.toLowerCase().includes(q))
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, Topic[]>()
    for (const t of filtered) {
      if (!map.has(t.group)) map.set(t.group, [])
      map.get(t.group)!.push(t)
    }
    return Array.from(map.entries())
  }, [filtered])

  const picked = activeId ? TOPICS.find(t => t.id === activeId) ?? null : null
  const active = picked ?? filtered[0] ?? null
  const mobileDetailOpen = picked !== null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl h-[92dvh] sm:h-[85vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Help Guide</h2>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the guide..."
            className="flex-1 min-w-0 text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 text-xl font-light leading-none px-1 ml-auto" aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Topic list -- hidden on phone once a topic is open, so it is one screen at a time there */}
          <div className={`${mobileDetailOpen ? 'hidden sm:block' : 'block'} w-full sm:w-56 shrink-0 border-r border-gray-200 overflow-y-auto py-2`}>
            {grouped.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8 px-3">No topics match "{query}".</p>
            ) : grouped.map(([group, topics]) => (
              <div key={group} className="mb-2">
                <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">{group}</p>
                {topics.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition ${active?.id === t.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className={`${mobileDetailOpen ? 'block' : 'hidden sm:block'} flex-1 min-w-0 overflow-y-auto p-4`}>
            {active ? (
              <div className="space-y-3 max-w-xl">
                <button onClick={() => setActiveId(null)} className="sm:hidden text-xs font-semibold text-blue-600 hover:underline">← All topics</button>
                <h3 className="text-lg font-bold text-gray-900">{active.title}</h3>
                {active.body}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">No topics match "{query}".</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2 text-center text-[11px] text-gray-500">
          Still stuck? Ask a manager -- this guide covers how the page works, not what to do about a specific sale.
        </div>
      </div>
    </div>
  )
}
