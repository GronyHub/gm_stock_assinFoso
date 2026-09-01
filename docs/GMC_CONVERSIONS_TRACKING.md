# GMC Conversions Tracking

## Overview

The SOURCE PACK column in Item 360 shows which pack was converted to create each GMC item. This feature uses two approaches for reliability and backward compatibility.

## Schema

- **Table**: `bill_lines`
- **New Column**: `source_pack_item_id` (INTEGER, nullable, foreign key to items.id)
- **Related Column**: `source_pack_name` (computed from join to items table)

## Implementation Approaches

### Approach 1: Direct Tracking (Recommended for new conversions)

When recording an Internal Consumption conversion:
1. Create a bill_line with:
   - `bill_id` = the Internal Consumption bill
   - `item_id` = the target GMC item (e.g., A4 Sheet Singles)
   - `quantity` = negative value (e.g., -500 for a full pack)
   - **`source_pack_item_id` = the pack item ID that was converted** (e.g., A4 SHEETS DOUBLE A)

2. The API will use `source_pack_item_id` directly to display the pack name

**Advantages:**
- Accurate tracking regardless of quantity
- No quantity matching needed
- Handles partial pack conversions (e.g., opening a pack but only using part of it)

### Approach 2: Quantity Matching (Backward compatible)

For existing records without `source_pack_item_id`:
1. The API matches the conversion quantity to pack `units_per_pack` values
2. If a pack has `units_per_pack = 500` and a conversion shows 500 sheets, it matches

**Limitations:**
- Requires quantities to exactly match pack sizes
- Cannot distinguish between multiple packs of same size
- Breaks if packs are partially used

## Data Migration

### Step 1: Run the Migration

```bash
# In your database management console or via psql:
psql your_database < migrations/add_source_pack_tracking.sql
```

### Step 2: Back-fill Existing Records (Optional)

If you know which pack was the source for existing conversions, update them:

```sql
-- Example: Set source_pack_item_id for A4 SHEETS DOUBLE A conversions
UPDATE bill_lines bl
SET source_pack_item_id = 123  -- ID of A4 SHEETS DOUBLE A
WHERE bl.bill_id IN (
  SELECT id FROM bills WHERE vendor_name = 'Internal Consumption'
)
AND bl.item_id = 456  -- ID of A4 Sheet Singles
AND bl.quantity < 0
AND bl.source_pack_item_id IS NULL;
```

### Step 3: Update Conversion Recording Logic

In your live_sale or bill entry UI, when recording a GMC conversion:
1. Present a dropdown/picker to select which pack was used
2. Set `source_pack_item_id` to that pack's ID
3. Record `quantity` as the full pack size (not individual sheets)

## API Behavior

The `/api/gmc-conversions` endpoint now:

1. **If `source_pack_item_id` is set**: Returns that pack's canonical_name directly
2. **If `source_pack_item_id` is NULL**: Falls back to quantity matching with packs
3. **If neither works**: Returns `null` for sourcePackName (shows "—" in UI)

## Example Response

```json
{
  "1": [
    {
      "date": "2026-09-01",
      "targetItem": "A4 Sheet Singles",
      "quantity": 500,
      "sourcePackName": "A4 SHEETS DOUBLE A"
    },
    {
      "date": "2026-09-02",
      "targetItem": "A4 Sheet Singles",
      "quantity": 6,
      "sourcePackName": null
    }
  ]
}
```

In this example:
- First entry has direct tracking → shows pack name
- Second entry is missing source_pack_item_id → no match found

## Current Data State

Current conversions show quantities of **1, 6, 32 sheets**, but packs are configured with **500 sheets per pack**.

**To populate SOURCE PACK for existing records**, you need to:

**Option A: Set source_pack_item_id directly**
```sql
UPDATE bill_lines
SET source_pack_item_id = (SELECT id FROM items WHERE canonical_name = 'A4 SHEETS DOUBLE A')
WHERE item_id = (SELECT id FROM items WHERE canonical_name = 'A4 Sheet Singles')
  AND source_pack_item_id IS NULL;
```

**Option B: Re-record conversions with correct quantities**
- Update to record full pack conversions (500 sheets instead of 1, 6, 32)
- Packs are then matched by quantity
- This requires changing how conversions are recorded in the live_sale flow

## Recommendation

Implement **Approach 1 (Direct Tracking)** for all new conversions:
- It's more accurate
- It handles partial pack usage
- It doesn't rely on quantity matching
- Back-fill old records when convenient using Option A above
