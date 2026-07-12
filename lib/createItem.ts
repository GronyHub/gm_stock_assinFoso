import sql from './db'

// Creates a brand-new item from typed text. Used anywhere a receipt/bill line's
// item name was typed rather than picked from the existing catalogue -- typed
// names are never matched against existing items by text, they always become
// their own new item. Any resulting near-duplicates are caught by the
// Duplicates flag and cleaned up via the existing merge tool.
export async function createItemFromTypedName(name: string, productType: 'goods' | 'service' = 'goods'): Promise<number> {
  const trimmed = name.trim()
  const [row] = await sql`
    INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, product_type, source)
    VALUES (
      ${'INTERNAL_' + trimmed.toUpperCase().replace(/\s+/g, '_')},
      ${trimmed}, ${trimmed}, ${productType}, 'internal'
    )
    RETURNING id
  `
  return row.id
}
