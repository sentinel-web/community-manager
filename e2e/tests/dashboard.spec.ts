import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard card', async ({ page }) => {
    // Dashboard has a main Card (type=inner) wrapping everything
    await expect(page.locator('.ant-card').first()).toBeVisible();
  });

  test('should display profile stats section', async ({ page }) => {
    // Collapse panel with profile stats
    await expect(page.locator('.ant-collapse')).toBeVisible();
    // Should have at least one collapse panel open
    await expect(page.locator('.ant-collapse-item').first()).toBeVisible();
  });

  test('should display collection stats', async ({ page }) => {
    // Wait for stats to load - should show Statistic components
    await expect(page.locator('.ant-statistic').first()).toBeVisible({ timeout: 10000 });
  });

  test('should have a refresh button', async ({ page }) => {
    const refreshBtn = page.locator('button.ant-btn-primary').filter({ hasText: /refresh/i });
    await expect(refreshBtn).toBeVisible();
  });
});
