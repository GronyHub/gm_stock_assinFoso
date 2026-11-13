# Brief: update the guide videos to the app as it is on 2026-11-13

Re-record the five STAFF tile videos (they now gate login, see components/VideoGate.tsx): sale, log, customers, counts, item360.
Then, if time allows, the six owner-only ones (bills, expenses, purchase_orders, vendors, pl, cab) for the new phone layout only.
Recording how-to: README.md in this folder (record.js, sample.js, Piper voice en_GB-alba-medium). Keep each video under about 4 minutes.

## What changed in the app since the videos were made (2026-11-09)
- "Live Sale" is now called **Live** everywhere (sidebar, captions, narration). Never say "Live Sale" or "Items".
- **Flags are no longer on Live, the Sales Log or the large screen.** They are only on the **Flags** page in the left sidebar.
  Remove the "Flags dropdown / pick a flag / strip / fix every flag" steps from sale.js. The manager fixes at least 5 flags a
  day there (law LS-26, managers only, so it is NOT read in the staff video; one sentence "flags are on the Flags page, the
  manager clears them" is enough).
- **Counts are separate from flags** (Counts page, own law: at least 10 counts a day, manager).
- **Signing laws is dropped completely.** The laws are statutory. Remove "you sign each law" / the "I have read this and
  will follow it" tap. Keep the sanctions sentence: 20 points = 3-day suspension, 30 = one week, 50 = dismissal; the owner approves.
- **Law quizzes are dropped.** Instead staff get ONE question of the day from the laws (a wrong answer offers the video).
- "Daily Checklist" is now **Waiting for team** (left sidebar). The tasks that fall on a person pop up as "It's time for ...".
- No sale can be recorded unless the person is clocked in.
- Phone layout: the staff profiles are slim rows at the top of the LEFT sidebar (photo, points, cedis; no names); there is no
  strip across the top any more. The icon/words switch row is gone. Mock /api/staff-times/worked-today, /api/penalties/summary
  and /api/staff/status in sample.js so these rows look real (invented people only).

## Laws to read in the Live (sale) video: the current live staff laws of the tile (codes are shown by the app, do not speak them)
Recording:
- All sales, bills and expenses are recorded in the GM app. Written work forms are no longer used. (1 pt)
- Every walk-in sale goes in Live with WIC on (GMC only for the shop's own use). A customer buying several items is sold through MI: one basket, one receipt. (1 pt)
- Record shop use as GMC and a customer sale as WIC. (1 pt)
- Give the customer a receipt for every sale. (1 pt)
- Never force a sale the app refuses: tell Joe. (1 pt)
- Enter every sale in the app: no sale is ever made without an entry. (20 pts)
- Never steal or pilfer money, goods or stock belonging to the shop. (20 pts)
- Before uploading the attachments, mark those you have entered. (1 pt)
Item list and prices:
- Always have a printed list of items, their SP and Count. Every sellable item at the shop must be on the item list. (1 pt each)
- Weekly: item groups checked, every good in the right group; leave no item in the wrong group or no group. (1 pt)
- Monthly: the price list is current and every staff member has it; never sell at an old price after the list is updated. (1 pt)
Understanding: what Live is for; the app abbreviations (SOH, SP, CP, WIC, GMC, MI, CAB); how to find, price and record a sale. (1 pt each)

## Sales Log video (log.js): add these laws after the how-to (currently it has none)
- Check the Sales Log at closing: every sale of the day is there, the cash is counted and matches, any difference is written down and told to Joe before leaving. (1 pt)
- A wrong tap is undone in the Sales Log the same day. Never delete or hide a sale to make a figure match. (3 pts)
- Receipts come from MI or the Sales Log, never retyped into Customer Receipts. (1 pt)
- Past days only with + Past sale and the right date; never type the same sale twice. (1 pt)

## Customers video: "In Live Sale" -> "In Live". Check the Customers page still has its own Flags filter before keeping that step.
## Counts and Item 360: re-record for the new layout; add the tile laws (Counts: COUNT NOW items counted daily; Item 360: find
   the cause in Item 360 before changing anything; item details changed only to fix a real mistake, never to hide a loss).

## After recording
For each video copy `public/guides/<key>.chapters.json` where a lib/videoChapters file exists (items.json for sale).
Check frames (SHOT= / STEP_SHOTS=1) before committing. Commit videos + scripts + chapters, push to main.
