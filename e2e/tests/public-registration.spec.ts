import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

/**
 * Regression guard for issue #207. The public registration form is reachable
 * by unauthenticated visitors (the "Register" button on the login screen). Its
 * "Discovery type" dropdown is backed by the `discoveryTypes` publication, which
 * used to gate *all* reads on `this.userId` — leaving the dropdown empty for
 * guests. `discoveryTypes` is now flagged `allowsAnonymous.read`, so guests can
 * see the options.
 */
test.describe('Public registration form', () => {
  const discoveryName = `E2E Discovery ${Date.now()}`;
  let discoveryId: string;

  // Seed a discovery type as admin; the test itself runs logged-out.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    discoveryId = await page.evaluate(
      async (name: string) => (await window.Meteor.callAsync('discoveryTypes.insert', { name })) as string,
      discoveryName
    );
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!discoveryId) return;
    const page = await browser.newPage();
    await login(page);
    await page.evaluate(async (id: string) => {
      await window.Meteor.callAsync('discoveryTypes.remove', id);
    }, discoveryId);
    await page.close();
  });

  test('anonymous visitor sees discovery type options', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login', { timeout: 15000 });

    // Open the registration drawer without authenticating.
    await page.click('button:has-text("Register")');
    await expect(page.locator('.ant-drawer')).toBeVisible();
    await expect(page.locator('.ant-drawer input[id="name"]')).toBeVisible();

    // Discovery type is the only Select in the registration form. Open it and
    // confirm the publication actually delivered options to the guest's client.
    const discoverySelect = page.locator('.ant-drawer .ant-select').first();
    await discoverySelect.click();

    // The dropdown renders in a body-level portal, so options are matched globally.
    await expect(page.locator('.ant-select-item-option').first()).toBeVisible();
    await expect(page.locator(`.ant-select-item-option:has-text("${discoveryName}")`)).toBeVisible();
  });
});
