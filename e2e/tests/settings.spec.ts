import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display settings page', async ({ page }) => {
    // Settings page uses SectionCard with title
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('should display community title input', async ({ page }) => {
    // Settings has an input for community title
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('should display logo upload area', async ({ page }) => {
    await expect(page.locator('.ant-upload-drag')).toBeVisible();
  });

  test('should display color picker', async ({ page }) => {
    await expect(page.locator('.ant-color-picker-trigger')).toBeVisible();
  });

  test('should display blacklist sections', async ({ page }) => {
    // Blacklist sections have input placeholders for name and id
    // Scroll down to ensure they're visible
    const nameInput = page.locator('input[placeholder*="black listed name" i]');
    const idInput = page.locator('input[placeholder*="black listed id" i]');
    await nameInput.scrollIntoViewIfNeeded();
    await expect(nameInput).toBeVisible();
    await expect(idInput).toBeVisible();
  });
});
