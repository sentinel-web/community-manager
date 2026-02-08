import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

test.describe('Logs', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
  });

  test('should display logs page with table', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('should display action filter input', async ({ page }) => {
    const searchInput = page.locator('.ant-input-search input');
    await expect(searchInput).toBeVisible();
  });

  test('should display date range picker', async ({ page }) => {
    await expect(page.locator('.ant-picker')).toBeVisible();
  });

  test('should filter logs by action', async ({ page }) => {
    const searchInput = page.locator('.ant-input-search input');
    await searchInput.fill('nonexistent_action_12345');
    // Auto-retrying assertion: no rows after filtering
    await expect(page.locator('tr[data-row-key]')).toHaveCount(0);
  });

  test('should have load more button', async ({ page }) => {
    // Load more button should exist (may be disabled if few logs)
    await expect(page.locator('button:has-text("Load")').first()).toBeVisible();
  });
});
