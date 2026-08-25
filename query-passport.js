#!/usr/bin/env node
/**
 * Direct database query script for Passport Picture investigation
 * Usage: node query-passport.js
 */

const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_sghPwB8NA9mE@ep-bold-lab-ahdj65dl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function query(sql) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('\n📡 Executing query...\n');
    const result = await client.query(sql);
    console.log(`✅ Found ${result.rows.length} rows\n`);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    console.log('🔍 Passport Picture Sales Investigation\n');
    console.log('=' .repeat(60));

    // 1. Find items
    console.log('\n1️⃣ Finding Passport/4x6 items...');
    const items = await query(`
      SELECT id, canonical_name, product_type, status
      FROM items
      WHERE LOWER(canonical_name) LIKE '%passport%'
         OR LOWER(canonical_name) LIKE '%4x6%'
      ORDER BY canonical_name;
    `);
    console.log(JSON.stringify(items, null, 2));

    if (items.length === 0) {
      console.log('❌ No items found');
      return;
    }

    // 2. Sales summary
    console.log('\n2️⃣ Sales count by item...');
    const salesSummary = await query(`
      SELECT
        i.id,
        i.canonical_name,
        COUNT(srl.id)::int as total_sales,
        MIN(sr.receipt_date)::text as first_sale,
        MAX(sr.receipt_date)::text as last_sale,
        SUM(srl.quantity)::numeric as total_qty
      FROM items i
      LEFT JOIN sales_receipt_lines srl ON srl.item_id = i.id
      LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE LOWER(i.canonical_name) LIKE '%passport%'
         OR LOWER(i.canonical_name) LIKE '%4x6%'
      GROUP BY i.id, i.canonical_name
      ORDER BY i.canonical_name;
    `);
    console.log(JSON.stringify(salesSummary, null, 2));

    // 3. Name mismatches
    console.log('\n3️⃣ Checking for name mismatches in sales records...');
    const mismatches = await query(`
      SELECT
        srl.item_id,
        i.canonical_name as current_name,
        srl.raw_item_name as recorded_name,
        COUNT(*)::int as count,
        MIN(sr.receipt_date)::text as first_date,
        MAX(sr.receipt_date)::text as last_date
      FROM sales_receipt_lines srl
      JOIN items i ON i.id = srl.item_id
      LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE LOWER(i.canonical_name) LIKE '%passport%'
         OR LOWER(i.canonical_name) LIKE '%4x6%'
      GROUP BY srl.item_id, i.canonical_name, srl.raw_item_name
      ORDER BY srl.item_id, count DESC;
    `);
    console.log(JSON.stringify(mismatches, null, 2));

    // 4. Sample sales
    console.log('\n4️⃣ Recent 30 sales samples...');
    const samples = await query(`
      SELECT
        sr.receipt_date::text,
        sr.receipt_number,
        i.id as item_id,
        i.canonical_name as current_name,
        srl.raw_item_name as recorded_name,
        srl.quantity::numeric,
        CASE WHEN sr.customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END as type
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items i ON i.id = srl.item_id
      WHERE LOWER(i.canonical_name) LIKE '%passport%'
         OR LOWER(i.canonical_name) LIKE '%4x6%'
      ORDER BY sr.receipt_date DESC
      LIMIT 30;
    `);
    console.log(JSON.stringify(samples, null, 2));

    // 5. Check aliases
    console.log('\n5️⃣ Checking for item aliases/renames...');
    const aliases = await query(`
      SELECT item_id, alias_name, alias_type, created_at::text
      FROM item_aliases
      WHERE item_id IN (
        SELECT id FROM items
        WHERE LOWER(canonical_name) LIKE '%passport%'
           OR LOWER(canonical_name) LIKE '%4x6%'
      )
      ORDER BY item_id, created_at DESC;
    `);
    if (aliases.length > 0) {
      console.log(JSON.stringify(aliases, null, 2));
    } else {
      console.log('(No aliases found)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Investigation complete!\n');

  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();
