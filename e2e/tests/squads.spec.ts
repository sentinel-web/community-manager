import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';
import { SectionPage } from '../pages/section.page';

test.describe('Squads', () => {
  let section: SectionPage;

  test.beforeEach(async ({ page }) => {
    await login(page);
    section = new SectionPage(page, '/squads');
    await section.goto();
  });

  test('should display table', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('should open create form drawer', async ({ page }) => {
    await section.clickCreate();
    await expect(page.locator('.ant-drawer')).toBeVisible();
    await expect(page.locator('input[id="name"]')).toBeVisible();
  });

  test('should show validation errors on empty submit', async () => {
    await section.clickCreate();
    await section.submitForm();
    await section.expectValidationError();
  });

  test('should create, verify, and delete a squad', async () => {
    const name = `E2E Squad ${Date.now()}`;

    await section.clickCreate();
    await section.fillFormField('name', name);
    await section.fillFormField('shortRangeFrequency', '150.5');
    await section.fillFormField('longRangeFrequency', '75.0');
    await section.submitForm();
    await section.waitForDrawerClose();

    await section.search(name);
    await section.expectRowVisible(name);

    await section.deleteRow(name);
    await section.expectRowHidden(name);
  });

  test('should search and filter', async () => {
    await section.search('nonexistent_e2e_12345');
    await section.expectEmptyTable();
  });
});
