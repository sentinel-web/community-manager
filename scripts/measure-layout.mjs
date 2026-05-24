// Diagnose the mobile scroll/clipping issue: measure the layout chain and find
// the real scroll container + whether the last content element is reachable.
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
  await page.goto(`${BASE}/members`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const report = await page.evaluate(() => {
    const sel = (s) => document.querySelector(s);
    const box = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        clientH: el.clientHeight,
        scrollH: el.scrollHeight,
        rectTop: Math.round(r.top),
        rectBottom: Math.round(r.bottom),
        overflowY: cs.overflowY,
        height: cs.height,
        flex: cs.flex,
        flexDir: cs.flexDirection,
      };
    };
    const out = {
      innerHeight: window.innerHeight,
      docScrollTop: document.scrollingElement.scrollTop,
      docScrollH: document.scrollingElement.scrollHeight,
      html: box(document.documentElement),
      app: box(sel('.app')),
      layout: box(sel('.ant-layout')),
      content: box(sel('.ant-layout-content')),
      container: box(sel('section.container')),
    };
    // Last data card and whether it sits below the viewport bottom.
    const cards = document.querySelectorAll('.ant-list-item');
    const last = cards[cards.length - 1];
    out.cardCount = cards.length;
    out.lastCardBottom = last ? Math.round(last.getBoundingClientRect().bottom) : null;
    return out;
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
