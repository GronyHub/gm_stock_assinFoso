# Passport Picture Sales Investigation Guide

## Background
Historical "Passport Picture" sales are mysteriously appearing as "4x6 singles" in the Sales view. Item IDs are now displayed in all item modal pages to help identify which item owns which records.

## Quick Investigation Steps

### 1. **Identify Item IDs**
- Go to **Biz → Sales** 
- Find a Passport Picture sale record
- Click the item name to open the modal—note the item_id in gray text next to the name
- Also check a "4x6 singles" sale and note its item_id
- Compare: are they the same ID or different?

### 2. **Database Queries (via SQL client or database tool)**

If you have direct database access (PostgreSQL client, pgAdmin, Neon console, etc.), run these queries:

#### Find all Passport/4x6 items:
```sql
SELECT id, canonical_name, product_type, status
FROM items
WHERE LOWER(canonical_name) LIKE '%passport%'
   OR LOWER(canonical_name) LIKE '%4x6%'
ORDER BY canonical_name;
```

#### Count sales for each item:
```sql
SELECT
  i.id,
  i.canonical_name,
  COUNT(srl.id) as total_sales,
  MIN(sr.receipt_date) as first_sale,
  MAX(sr.receipt_date) as last_sale,
  SUM(srl.quantity) as total_qty
FROM items i
LEFT JOIN sales_receipt_lines srl ON srl.item_id = i.id
LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
WHERE i.id IN (
  SELECT id FROM items 
  WHERE LOWER(canonical_name) LIKE '%passport%'
     OR LOWER(canonical_name) LIKE '%4x6%'
)
GROUP BY i.id, i.canonical_name
ORDER BY i.canonical_name;
```

#### Check for name mismatches (what names are recorded vs. current canonical name):
```sql
SELECT
  srl.item_id,
  i.canonical_name as current_name,
  srl.raw_item_name as recorded_name,
  COUNT(*) as count,
  MIN(sr.receipt_date) as first_date,
  MAX(sr.receipt_date) as last_date
FROM sales_receipt_lines srl
JOIN items i ON i.id = srl.item_id
LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
WHERE i.id IN (
  SELECT id FROM items 
  WHERE LOWER(canonical_name) LIKE '%passport%'
     OR LOWER(canonical_name) LIKE '%4x6%'
)
GROUP BY srl.item_id, i.canonical_name, srl.raw_item_name
ORDER BY srl.item_id, count DESC;
```

#### Check if there were item aliases/renames:
```sql
SELECT item_id, alias_name, alias_type, created_at, updated_at
FROM item_aliases
WHERE item_id IN (
  SELECT id FROM items 
  WHERE LOWER(canonical_name) LIKE '%passport%'
     OR LOWER(canonical_name) LIKE '%4x6%'
)
ORDER BY item_id, created_at DESC;
```

## What to Look For

1. **If Passport Picture sales have the 4x6 singles item_id:**
   - This indicates sales were recorded with the wrong item_id
   - Likely causes: item merge, incorrect item_id in data, or historical data issue

2. **If they have different item_ids:**
   - But display shows wrong name, check `raw_item_name` vs. `canonical_name`
   - If `raw_item_name` shows "Passport Picture" but item was renamed, it's a historical naming issue

3. **If there are aliases:**
   - A 4x6 singles item may have been merged or aliased to Passport Picture (or vice versa)
   - Check item status (Active/Inactive) to see if one was merged away

## Next Steps

After running queries:
- Share the item_ids you find (and the exact item names)
- Share the query results showing name mismatches
- This will help pinpoint the root cause
