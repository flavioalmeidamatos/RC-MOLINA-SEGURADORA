/**
 * Playwright script to capture a screenshot of the Campanhas page.
 * Usage: node scripts/screenshot_campanhas.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_PATH = path.join(__dirname, '..', 'campanhas_screenshot.png');
const SCREENSHOT_FULL_PATH = path.join(__dirname, '..', 'campanhas_screenshot_full.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('1. Navigating to dashboard directly...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for the preloader to finish (it has onComplete callback)
  console.log('2. Waiting for preloader...');
  await page.waitForTimeout(5000);

  // Check current URL
  const currentUrl = page.url();
  console.log(`6. Current URL: ${currentUrl}`);

  // Take a screenshot of current state
  await page.screenshot({ path: SCREENSHOT_PATH.replace('.png', '_dashboard.png'), fullPage: false });
  console.log('   Dashboard screenshot saved.');

  // Now click on "Campanhas" in the sidebar
  console.log('7. Looking for Campanhas menu item...');
  
  // Try to find and click the Campanhas menu item
  const campanhasButton = await page.$('text=Campanhas');
  if (campanhasButton) {
    console.log('8. Found Campanhas, clicking...');
    await campanhasButton.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('8. Could not find Campanhas text, trying sidebar buttons...');
    // Try to find it among sidebar nav items
    const sidebarButtons = await page.$$('aside button');
    for (const btn of sidebarButtons) {
      const text = await btn.textContent();
      if (text && text.includes('Campanhas')) {
        console.log('   Found Campanhas button in sidebar, clicking...');
        await btn.click();
        await page.waitForTimeout(3000);
        break;
      }
    }
  }

  // Take the Campanhas screenshot
  console.log('9. Taking Campanhas page screenshot...');
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log(`   Viewport screenshot saved to: ${SCREENSHOT_PATH}`);

  await page.screenshot({ path: SCREENSHOT_FULL_PATH, fullPage: true });
  console.log(`   Full page screenshot saved to: ${SCREENSHOT_FULL_PATH}`);

  // Get page dimensions info
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  console.log(`\n10. Page metrics:`);
  console.log(`    Viewport: ${viewportWidth}x${viewportHeight}`);
  console.log(`    Body scroll height: ${bodyHeight}`);
  console.log(`    Overflow: ${bodyHeight > viewportHeight ? 'YES - content overflows viewport!' : 'No overflow'}`);

  // Check for specific elements visibility
  const checks = [
    { selector: '[class*="campanhas"]', name: 'Campanhas container' },
    { selector: 'textarea', name: 'Message textarea' },
    { selector: 'button:has-text("Disparar")', name: 'Disparar button' },
    { selector: 'button:has-text("Salvar")', name: 'Salvar button' },
  ];

  console.log('\n11. Element visibility checks:');
  for (const check of checks) {
    try {
      const el = await page.$(check.selector);
      if (el) {
        const box = await el.boundingBox();
        const visible = box && box.y < viewportHeight && box.y + box.height > 0;
        console.log(`    ${check.name}: ${visible ? 'VISIBLE' : 'HIDDEN (below fold)'} ${box ? `at y=${Math.round(box.y)}` : ''}`);
        
        if (check.name === 'Message textarea') {
           const parent = await el.evaluateHandle(node => node.parentElement?.parentElement);
           const html = await page.evaluate(node => node.innerHTML, parent);
           console.log('--- Editor HTML ---');
           console.log(html);
           console.log('-------------------');
        }
      } else {
        console.log(`    ${check.name}: NOT FOUND`);
      }
    } catch {
      console.log(`    ${check.name}: error checking`);
    }
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
