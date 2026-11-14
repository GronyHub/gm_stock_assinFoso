# Item hub route split — findings and phased plan

Status: **plan only, no behaviour change.** Written 2026-10-11 after sizing the work.

## What the code looks like today
- `app/(protected)/item/page.tsx`: one 10,198-line / 610 KB client file.
  `ItemHubPageInner` is a single function component (~9,400 lines) with 231
  `useState`, ~60 inline handlers and 11 `usePolling` calls.
- It is the *shell* (sidebar `SidePane`, header, `PresentStaffBar`, tab
  switcher, toasts, modals), the *Live Sale* screen (tap logic, GMC gates,
  item grid) **and** the mount point for every other view (`outerTab` +
  `lossView` switches, around lines 9795-9970).
- Most other views are already separate, lazily loaded components
  (`VendorsPage`, `CustomersPage`, `CountsTab`, `DailySummaryTab`,
  `PurchaseOrdersPage`, `TodayContent`, ...). Moving *them* to routes saves
  almost nothing; the cost is the shell + Live Sale code and ~17 delayed fetches
  that run whichever view is open.
- Default landing view is Live Sale, which consumes most of those fetches.

## Why a naive route split does not help
`/item/vendors` etc. would need the sidebar, badge counts, permissions, pane
order/labels/groups/hidden, staff list and flags. All of that lives inside the
one component. Navigating to a route and back would re-mount the whole shell and
re-run every mount fetch, which is *slower* than today's in-page tab switch.

## Phased plan (each phase shippable on its own)
1. **Extract the shell data into a provider** (`ItemShellProvider`, in an
   `item/layout.tsx`): permissions, staff roster, pane order/labels/groups/hidden,
   badge counts (`loadBadgeData`, `useViolations`). Pure move, no UI change.
   Verify: sidebar badges and ordering identical on every view.
2. **Extract the sidebar + header into `ItemShell`** that reads the provider and
   navigates with `router.push` instead of `setLossView`. Keep `?view=`/`?tab=`
   URLs working (they already exist for deep links).
3. **Move read-only views to routes**, one per PR: Daily Summary, Purchase
   Orders, Vendors, Customers, Today/Home, Expense Orders, Activity Durations,
   View Portal As, Reorder Lists. Each fetches its own data only while mounted.
4. **Live Sale / Count / Sales / Bills / Expenses last.** They share the tap
   state, GMC overage gate, pending-tap refs and `liveCurrentView`; they need a
   Live Sale store (context or zustand) first.

## Risks / what must be tested before each phase merges
- Live Sale tap flow end to end (clock-in gate, GMC overage gate, undo).
- Unsaved drafts on tab change (new bill, count in progress).
- Badge counts and flag counts match before/after.
- Browser back button, deep links (`/item?tab=loss&view=sales&jumpDate=...`).
- Needs a real database to test; the dev sandbox cannot reach Neon, so each
  phase should be exercised on the droplet (or a Neon branch + preview) with the
  shop closed (Sunday) before merging.

## Already shipped (no route split needed)
- Lazy-loaded LossTab pickers, ItemDetailPanel, Handbook, Laws viewer, expense
  orders and UK settings: first-load JS 769 KB -> 585 KB.
- Duplicate-item query 533 ms -> 57 ms (trigram index); flags/loss caches warmed
  in shop hours (see `instrumentation.ts`).
