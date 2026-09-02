<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Item pickers must read from active_items, not items

`items` holds both Active and Inactive rows — merging a duplicate (see
`lib/mergeItems.ts`) never deletes or moves the loser, it just flips its
`status` to `Inactive` and leaves it in place. Any endpoint that lists items
for a human to *pick from* (autocomplete, search-to-attach, a new Purchase
Order/Bill/Sale line) must query the `active_items` view instead of `items`
directly, or an already-merged duplicate can be re-selected and silently
reopen the exact bug it was merged to fix. This happened for real: an item
merged on 2026-07-22 was still offered by `/api/items/search` and got
re-picked into a Purchase Order on 2026-07-30, crediting stock to the wrong,
retired item.

`active_items` is just `SELECT * FROM items WHERE status IS NULL OR
LOWER(status) != 'inactive'` — safe to join/filter further as needed. It's
only for reads that list/search candidates. Single-item-by-id lookups and
all writes (edits, merges, status changes) should keep using the raw `items`
table, since they often need to operate on an item regardless of its current
status.

# Neon Free Tier (10 GB Storage Limit)

**Automatic optimizations in place:**
- 5-minute API caching on `/api/losses/summary` (~70-80% query reduction)
- Automatic data retention policies delete old logs/tokens
- `/api/maintenance/optimize-db` endpoint for weekly cleanup

**Weekly maintenance (set in your scheduler):**
```bash
curl -X POST https://yourapp.com/api/maintenance/optimize-db \
  -H "Authorization: Bearer $MAINTENANCE_SECRET"
```

**Data retention policy:** See `.claude/DATA_RETENTION.md` for full details.
- `live_sale_taps`: 6 months (completed only)
- `manage_logs`: 1 year max
- `password_reset_tokens`: 24 hours
- `training_attempts`: 6 months
- Core data (items, receipts, POs): Indefinite

**If you exceed 10 GB:** Upgrade to Neon Pro ($15/month, 500 GB) or archive old data to S3.
