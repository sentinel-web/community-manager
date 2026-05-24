// Verify the mobile navigation dropdown is capped to the viewport and scrolls.
// Writes to /tmp so it never trips Meteor's file watcher.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.Meteor && !!window.Meteor.loginWithPassword, null, { timeout: 30000 });
  await page.evaluate(
    () => new Promise((res, rej) => window.Meteor.loginWithPassword('admin', 'admin', e => (e ? rej(new Error(e.reason || e.message)) : res())))
  );
  await page.waitForFunction(() => window.Meteor && window.Meteor.userId(), null, { timeout: 30000 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Open the dropdown via a direct DOM click (bypasses any dev overlay).
  await page.evaluate(() => document.querySelector('nav button')?.click());
  await page.waitForSelector('.ant-dropdown-menu', { timeout: 10000 });
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const menu = document.querySelector('.ant-dropdown-menu');
    if (!menu) return null;
    const r = menu.getBoundingClientRect();
    return {
      clientHeight: menu.clientHeight,
      scrollHeight: menu.scrollHeight,
      bottom: Math.round(r.bottom),
      viewportHeight: window.innerHeight,
      scrollable: menu.scrollHeight > menu.clientHeight,
      withinViewport: r.bottom <= window.innerHeight,
    };
  });
  console.log('menu metrics:', JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: '/tmp/cm-shots/menu-open.png' });
  console.log('screenshot -> /tmp/cm-shots/menu-open.png');
} finally {
  await browser.close();
}
