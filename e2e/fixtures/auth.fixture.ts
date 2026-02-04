import { test as base, expect, Page } from '@playwright/test';

/**
 * Login helper function
 */
export async function login(page: Page, username = 'admin', password = 'admin'): Promise<void> {
  await page.goto('/');

  // Check if already logged in (nav button visible means logged in)
  const isLoggedIn = await page.locator('nav button').isVisible({ timeout: 3000 }).catch(() => false);
  if (isLoggedIn) {
    return; // Already logged in
  }

  // Wait for login page to load
  await page.waitForSelector('.login', { timeout: 15000 });

  // Fill credentials using Ant Design form
  await page.fill('input[id="username"]', username);
  await page.fill('input[id="password"]', password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for login to complete - navigation menu becomes visible
  await expect(page.locator('nav button')).toBeVisible({ timeout: 15000 });
}

/**
 * Logout helper function
 */
export async function logout(page: Page): Promise<void> {
  // The logout is in the user dropdown at bottom left - click on the user area
  const userArea = page.locator('text=Admin >> xpath=ancestor::*[contains(@class, "ant-dropdown-trigger")]').first();
  if (await userArea.isVisible({ timeout: 3000 }).catch(() => false)) {
    await userArea.click();
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await page.click('[role="menuitem"]:has-text("Logout")');
  } else {
    // Try clicking directly on the Admin text with dropdown
    await page.click('text=Admin');
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await page.click('[role="menuitem"]:has-text("Logout")');
  }

  // Wait for redirect to login page
  await page.waitForSelector('.login', { timeout: 10000 });
}

/**
 * Extended test fixture with automatic authentication
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Login before each test
    await login(page);
    await use(page);
  },
});

export { expect };
