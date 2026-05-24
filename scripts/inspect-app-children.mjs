// Inspect the direct children of .app to judge whether the orientation-based
// flex-direction rule (audit finding #7) still does anything meaningful.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();

async function dump(label, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.Meteor && !!window.Meteor.loginWithPassword, null, { timeout: 30000 });
  await page.evaluate(
    () => new Promise((res, rej) => window.Meteor.loginWithPassword('admin', 'admin', e => (e ? rej(new Error(e.reason || e.message)) : res())))
  );
  await page.waitForFunction(() => window.Meteor && window.Meteor.userId(), null, { timeout: 30000 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const app = document.querySelector('.app');
    if (!app) return null;
    const cs = getComputedStyle(app);
    const children = [...app.children].map(el => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().split(' ')[0],
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        h: Math.round(r.height),
      };
    });
    return { flexDirection: cs.flexDirection, display: cs.display, childCount: app.children.length, children };
  });
  console.log(`\n=== ${label} (${viewport.width}x${viewport.height}) ===`);
  console.log(JSON.stringify(info, null, 2));
  await context.close();
}

try {
  await dump('portrait', { width: 375, height: 812 });
  await dump('landscape', { width: 812, height: 375 });
} finally {
  await browser.close();
}
