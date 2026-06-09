import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  
  console.log("Navigating to campanhas...");
  await page.goto('https://rcmolinaseguros.resolveplanilhas.com.br/campanhas');
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
