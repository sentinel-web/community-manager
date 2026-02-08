import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

test.describe('Orbat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/orbat');
    await page.waitForLoadState('networkidle');
  });

  test('should display orbat card', async ({ page }) => {
    await expect(page.locator('.ant-card').first()).toBeVisible();
  });

  test('should display view type selector', async ({ page }) => {
    // Orbat has a Select in the card's extra area (Simple/Advanced)
    // Use the card extra area to avoid matching the language selector
    const viewSelector = page.locator('.ant-card-extra .ant-select');
    await expect(viewSelector).toBeVisible();
  });

  test('should show tree or empty state', async ({ page }) => {
    // Either tree content or empty state should be visible
    const treeOrEmpty = page.locator('.ant-typography, .ant-empty').first();
    await expect(treeOrEmpty).toBeVisible();
  });

  test('should switch between simple and advanced views', async ({ page }) => {
    // Click the view selector in the card extra area
    const viewSelector = page.locator('.ant-card-extra .ant-select');
    await viewSelector.click();
    // Select advanced view
    await page.locator('.ant-select-item-option').filter({ hasText: /advanced/i }).click();
    // Page should still be visible (auto-retrying)
    await expect(page.locator('.ant-card').first()).toBeVisible();
  });
});
