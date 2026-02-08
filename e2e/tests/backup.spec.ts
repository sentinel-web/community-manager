import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

test.describe('Backup', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/backup');
    await page.waitForLoadState('networkidle');
  });

  test('should display backup page', async ({ page }) => {
    await expect(page.locator('.ant-card')).toBeVisible();
  });

  test('should display download backup button', async ({ page }) => {
    const downloadBtn = page.locator('button.ant-btn-primary').first();
    await expect(downloadBtn).toBeVisible();
  });

  test('should display restore upload area', async ({ page }) => {
    await expect(page.locator('.ant-upload-drag')).toBeVisible();
  });

  test('should display warning alert for restore', async ({ page }) => {
    await expect(page.locator('.ant-alert-warning')).toBeVisible();
  });
});
