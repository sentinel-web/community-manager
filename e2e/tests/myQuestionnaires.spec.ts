import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';

test.describe('My Questionnaires', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/myQuestionnaires');
    await page.waitForLoadState('networkidle');
  });

  test('should display my questionnaires page', async ({ page }) => {
    // Page title "My Questionnaires" is in the SectionCard heading
    await expect(page.locator('h2:has-text("My Questionnaires")')).toBeVisible();
  });

  test('should show questionnaire cards or empty state', async ({ page }) => {
    // Either questionnaire cards (with actions) or empty state
    const cardsOrEmpty = page.locator('.ant-card-actions, .ant-empty').first();
    await expect(cardsOrEmpty).toBeVisible();
  });
});
