-- Add source_pack_item_id column to track which pack was the source of a conversion
-- This allows direct tracking of pack-to-gmc conversions without relying on quantity matching

ALTER TABLE bill_lines
ADD COLUMN source_pack_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL;

-- Index for fast lookups when filtering by source pack
CREATE INDEX idx_bill_lines_source_pack_item_id ON bill_lines(source_pack_item_id)
WHERE source_pack_item_id IS NOT NULL;

-- Index for Internal Consumption conversions with source pack
CREATE INDEX idx_bill_lines_internal_consumption_source_pack ON bill_lines(bill_id, source_pack_item_id)
WHERE source_pack_item_id IS NOT NULL;
