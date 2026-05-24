// One-off: capture every navigable view (docs/views-and-forms.md) at desktop +
// mobile widths. Logs in via the real login form, then loops viewports × views.
// Writes to /tmp first so Meteor's file watcher never sees the image writes.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = '/tmp/cm-shots';

// Nav key → filename order, mirrors the Navigable views table.
const VIEWS = [
  'dashboard', 'orbat', 'events', 'eventTypes', 'briefingTemplates',
  'tasks', 'taskStatus', 'squads', 'members', 'ranks', 'specializations',
  'medals', 'positions', 'registrations', 'discoveryTypes', 'roles',
  'questionnaires', 'myQuestionnaires', 'logs', 'settings', 'backup',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

const pad = i => String(i + 1).padStart(2, '0');

async function login(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  // Log in through the accounts API rather than a DOM click: the dev-server HMR
  // overlay iframe can intercept pointer events during a rebuild, and a fresh
  // browser context has clean storage so the resume token persists cleanly.
  await page.waitForFunction(() => !!window.Meteor && !!window.Meteor.loginWithPassword, null, { timeout: 30000 });
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        window.Meteor.loginWithPassword('admin', 'admin', err => (err ? reject(new Error(err.reason || err.message)) : resolve()));
      })
  );
  await page.waitForFunction(() => window.Meteor && window.Meteor.userId(), null, { timeout: 30000 });
  await page.waitForSelector('.login', { state: 'detached', timeout: 30000 }).catch(() => {});
}

async function capture(page, vp) {
  const dir = `${OUT}/${vp.name}`;
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (let i = 0; i < VIEWS.length; i++) {
    const key = VIEWS[i];
    await page.goto(`${BASE}/${key}`, { waitUntil: 'domcontentloaded' });
    // Let lazy chunk + subscriptions settle; networkidle then a fixed beat.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const file = `${dir}/${pad(i)}-${key}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ${vp.name.padEnd(7)} ${key.padEnd(20)} -> ${file}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
try {
  console.log('Logging in...');
  await login(page);
  console.log('Logged in. Capturing views.');
  for (const vp of VIEWPORTS) await capture(page, vp);
  console.log('Done.');
} finally {
  await browser.close();
}
