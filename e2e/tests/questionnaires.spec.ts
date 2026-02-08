import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth.fixture';
import { SectionPage } from '../pages/section.page';

test.describe('Questionnaires', () => {
  let section: SectionPage;

  test.beforeEach(async ({ page }) => {
    await login(page);
    section = new SectionPage(page, '/questionnaires');
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

  test('should create, verify, and delete a questionnaire', async () => {
    const name = `E2E Questionnaire ${Date.now()}`;

    await section.clickCreate();
    await section.fillFormField('name', name);
    await section.submitForm();
    await section.waitForDrawerClose();

    await section.search(name);
    await section.expectRowVisible(name);

    await section.deleteRow(name);
    await section.expectRowHidden(name);
  });

  test('should create questionnaire with questions', async ({ page }) => {
    const name = `E2E QWithQ ${Date.now()}`;

    await section.clickCreate();
    await section.fillFormField('name', name);

    // Add a question
    await page.click('button:has-text("Add Question")');

    // Fill the question text
    const questionInput = page.locator('input[id="questions_0_text"]');
    await questionInput.fill('How satisfied are you?');

    // Select question type
    const typeSelect = page.locator('#questions_0_type');
    await typeSelect.click();
    await page.locator('.ant-select-item-option').filter({ hasText: 'Rating' }).click();

    await section.submitForm();
    await section.waitForDrawerClose();

    await section.search(name);
    await section.expectRowVisible(name);

    // Clean up
    await section.deleteRow(name);
    await section.expectRowHidden(name);
  });

  test('should search and filter', async () => {
    await section.search('nonexistent_e2e_12345');
    await section.expectEmptyTable();
  });
});
