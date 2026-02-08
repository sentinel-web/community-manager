import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Clear auth for these tests

  test('should login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('admin', 'admin');

    // Wait for navigation menu to appear (indicates successful login)
    await expect(page.locator('nav button')).toBeVisible({ timeout: 15000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('admin', 'wrongpassword');
    await loginPage.waitForLoginError();

    // Should still be on login page
    await expect(loginPage.isLoginCardVisible()).resolves.toBe(true);
  });

  test('should show error for non-existent user', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('nonexistent', 'password');
    await loginPage.waitForLoginError();

    await expect(loginPage.isLoginCardVisible()).resolves.toBe(true);
  });

  test('should persist session on page reload', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const navPage = new NavigationPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login('admin', 'admin');

    // Wait for login to complete
    await navPage.waitForNavigationReady();

    // Reload page
    await page.reload();

    // Should still be authenticated
    await navPage.waitForNavigationReady();
  });

  test('should logout successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const navPage = new NavigationPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login('admin', 'admin');

    // Wait for login to complete
    await navPage.waitForNavigationReady();

    // Logout via Footer dropdown
    await navPage.logout();

    // Should be back on login page
    await expect(loginPage.isLoginCardVisible()).resolves.toBe(true);
  });
});
