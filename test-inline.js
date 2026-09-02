const pw = require('./node_modules/playwright');
const { chromium } = pw;
const fetch = require('node-fetch');

async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch('http://localhost:3000/', { timeout: 2000 });
      if (res.status) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Server did not start');
}

async function test() {
  console.log('Waiting for server...');
  await waitForServer();
  console.log('Server ready\n');

  const browser = await chromium.launch({ 
    executablePath: '/opt/pw-browsers/chromium/chrome',
    args: ['--no-sandbox'],
    headless: true
  });
  const page = await browser.newPage();
  
  try {
    console.log('Loading app...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✓ App loaded\n');
    
    // Wait for full render
    await page.waitForTimeout(1500);
    
    // Look for Loss sidebar item or tab
    const loss = await page.locator('text=/Loss/i').first();
    if (await loss.isVisible().catch(() => false)) {
      console.log('Clicking Loss tab...');
      await loss.click();
      await page.waitForTimeout(800);
    }
    
    // Look for Expenses option
    const exp = await page.locator('text=/^Expenses$/i').first();
    if (await exp.isVisible().catch(() => false)) {
      console.log('Clicking Expenses option...');
      await exp.click();
      await page.waitForTimeout(800);
    }
    
    // Find Expense Orders radio
    console.log('\nLooking for Expense Orders radio...');
    const label = await page.locator('label:has(input[type="radio"])').filter({ has: page.locator('text=Expense Orders') }).first();
    
    if (await label.isVisible().catch(() => false)) {
      console.log('✓ Found Expense Orders radio');
      
      // Click it
      await label.click();
      console.log('✓ Clicked it');
      await page.waitForTimeout(600);
      
      // Check if panel opened
      const panel = await page.locator('input[list*="items"]').first();
      const visible = await panel.isVisible().catch(() => false);
      
      if (visible) {
        console.log('\n✓✓ SUCCESS: ExpenseOrdersPanel opened inline!');
        console.log('   The form inputs are now visible in the Expenses tab\n');
        await page.screenshot({ path: '/tmp/success.png' });
        console.log('Screenshot: /tmp/success.png');
      } else {
        console.log('\n✗ Panel not found');
      }
    } else {
      console.log('✗ Expense Orders radio not found');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
