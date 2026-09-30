#!/usr/bin/env node
/**
 * Seed script to add Assin locations to the database
 * Run with: node scripts/seed-assin-locations.js
 */

const locations = [
  "Assin Akonfudi", "Assin Jakai", "Assin Manso", "Assin Fosu", "Assin Praso",
  "Assin Adum", "Assin Nyankumasi", "Assin Bereku", "Assin Kwadaso", "Assin Attakrom",
  "Assin Semaso", "Assin Domeabra", "Assin Owusu-Sekyere", "Assin Tafo", "Assin Breman",
  "Assin Gyamera", "Assin Ankrah", "Assin Adumbire", "Assin Wawase", "Assin Brafu",
  "Assin Kesse", "Assin Nfranso", "Assin Enyinimso", "Assin Apemenyim", "Assin Anukyi",
  "Assin Owusu Brempong", "Assin Kwatia", "Assin Kwasikrom", "Assin Annobil", "Assin Forikrom",
  "Assin Kyekyewere", "Assin Juansa", "Assin Kofi Mensah", "Assin Kwadaso South", "Assin Juansa Central",
  "Assin Nsuaem", "Assin Brofoyedu", "Assin Mampong", "Assin Enim", "Assin Aboabo",
  "Assin Essuman", "Assin Apiadan", "Assin Twifo Hemang", "Assin Asankrangwa", "Assin Brofoyedu Central",
  "Assin Ansumakrom", "Assin Nyamako", "Assin Achiase", "Assin Kisii", "Assin Okrade",
  "Assin Krofoyedu", "Assin Anwomaso", "Assin Amamaso", "Assin Asokwa", "Assin Adako",
  "Assin Akotsi", "Assin Amesikarom", "Assin Adum South", "Assin Akyekyedem", "Assin Asee",
  "Assin Abandze", "Assin Ansifo", "Assin Amoada", "Assin Achikyir", "Assin Adeiso",
  "Assin Abaa", "Assin Abamu", "Assin Abenin", "Assin Aboadzi", "Assin Abodum",
  "Assin Abogya", "Assin Abomoso", "Assin Aboso", "Assin Abrafo", "Assin Abrade",
  "Assin Abramu", "Assin Abranim", "Assin Abranwam", "Assin Abraso", "Assin Abretima",
  "Assin Abretso", "Assin Abrim", "Assin Abroso", "Assin Abrum", "Assin Abrussi",
  "Assin Abruwa", "Assin Abuadu", "Assin Abuano", "Assin Abuasi", "Assin Abuasi Junction",
  "Assin Abubai", "Assin Abubaise", "Assin Abubawe", "Assin Abuboi", "Assin Abubokoram",
  "Assin Abulenu", "Assin Abulkrom", "Assin Abuloso", "Assin Abuluasi", "Assin Abundan",
  "Assin Abundanu", "Assin Abuodum", "Assin Abuosuo", "Assin Abuprehu", "Assin Abura",
  "Assin Aburaaso", "Assin Aburahim", "Assin Aburakrom", "Assin Aburata", "Assin Aburfoso",
  "Assin Aburikrom", "Assin Aburiso", "Assin Aburm", "Assin Aburnu", "Assin Aburonso",
  "Assin Aburonsor", "Assin Aburonti", "Assin Aburoso", "Assin Aburusua"
];

const { Client } = require('pg');

async function seedLocations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log(`\n📍 Seeding ${locations.length} Assin locations...\n`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  try {
    console.log('Attempting to connect to database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***set***' : 'NOT SET');
    await client.connect();
    console.log('✓ Connected to database');

    for (const location of locations) {
      try {
        const existing = await client.query(
          'SELECT 1 FROM locations WHERE LOWER(location) = LOWER($1)',
          [location]
        );

        if (existing.rows.length > 0) {
          console.log(`⏭️  Skipped: ${location} (already exists)`);
          skipped++;
        } else {
          await client.query(
            'INSERT INTO locations (location) VALUES ($1)',
            [location]
          );
          console.log(`✓ Added: ${location}`);
          added++;
        }
      } catch (err) {
        console.log(`✗ Failed: ${location} - ${err.message}`);
        failed++;
      }
    }
  } finally {
    await client.end();
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   Added: ${added}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed: ${failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

seedLocations().catch(err => {
  console.error('\n❌ Seeding failed:');
  console.error(err);
  console.error('Error details:', {
    message: err?.message,
    code: err?.code,
    stack: err?.stack
  });
  process.exit(1);
});
