import { test, expect } from '@playwright/test';
import { NavigationPage } from '../pages/navigation.page';
import { login } from '../fixtures/auth.fixture';

test.describe('Navigation', () => {
  let navPage: NavigationPage;

  test.beforeEach(async ({ page }) => {
    await login(page);
    navPage = new NavigationPage(page);
  });

  test('should show navigation menu when authenticated', async ({ page }) => {
    await expect(page.locator('nav button')).toBeVisible();
  });

  test('should navigate between sections', async ({ page }) => {
    // Navigate to events
    await navPage.navigateTo('Events');
    await expect(page).toHaveURL(/.*events/);

    // Navigate to tasks
    await navPage.navigateTo('Tasks');
    await expect(page).toHaveURL(/.*tasks/);

    // Navigate to squads
    await navPage.navigateTo('Squads');
    await expect(page).toHaveURL(/.*squads/);

    // Navigate back to members
    await navPage.navigateTo('Members');
    await expect(page).toHaveURL(/.*members/);
  });

  test('should update URL on navigation', async ({ page }) => {
    await navPage.navigateTo('Members');

    const path = navPage.getCurrentPath();
    expect(path).toBe('/members');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate to members
    await navPage.navigateTo('Members');
    await expect(page).toHaveURL(/.*members/);

    // Navigate to events
    await navPage.navigateTo('Events');
    await expect(page).toHaveURL(/.*events/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/.*members/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/.*events/);
  });

  test('should show multiple menu items for admin user', async () => {
    const items = await navPage.getVisibleMenuItems();

    // Admin should see multiple menu items
    expect(items.length).toBeGreaterThan(5);

    // Check for expected items
    expect(items.some(item => item.toLowerCase().includes('member'))).toBe(true);
    expect(items.some(item => item.toLowerCase().includes('event'))).toBe(true);
    expect(items.some(item => item.toLowerCase().includes('task'))).toBe(true);
  });
});
