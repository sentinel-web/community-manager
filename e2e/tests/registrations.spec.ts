import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';
import { SectionPage } from '../pages/section.page';

test.describe('Registrations', () => {
  let section: SectionPage;

  test.beforeEach(async ({ page }) => {
    await login(page);
    section = new SectionPage(page, '/registrations');
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

  test('should create, verify, and delete a registration', async ({ page }) => {
    const testId = Math.floor(Math.random() * 8999) + 1000;
    const name = `E2E Reg ${Date.now()}`;

    await section.clickCreate();
    await section.fillFormField('name', name);

    // Fill the InputNumber for id
    const idInput = page.locator('input[id="id"]');
    await idInput.fill(testId.toString());

    // Fill age InputNumber
    const ageInput = page.locator('input[id="age"]');
    await ageInput.fill('25');

    // Toggle rulesReadAndAccepted switch
    const rulesSwitch = page.locator('.ant-form-item').filter({ hasText: /rules/i }).locator('.ant-switch');
    await rulesSwitch.click();

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
