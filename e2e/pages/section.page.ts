import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Generic page object for Section-based CRUD pages.
 * Handles table display, search, create/edit/delete operations.
 */
export class SectionPage extends BasePage {
  readonly route: string;

  constructor(page: Page, route: string) {
    super(page);
    this.route = route;
  }

  /**
   * Navigate to the section page and wait for table or empty state
   */
  async goto(): Promise<void> {
    await this.page.goto(this.route);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForSelector('.ant-table, .ant-empty', { timeout: 15000 });
  }

  /**
   * Search by typing into the search input
   */
  async search(query: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    await searchInput.fill(query);
  }

  /**
   * Clear the search input
   */
  async clearSearch(): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    await searchInput.clear();
  }

  /**
   * Click the Create button and wait for the drawer to open
   */
  async clickCreate(): Promise<void> {
    await this.page.click('button:has-text("Create")');
    await this.waitForDrawerOpen();
  }

  /**
   * Get the number of rows in the table
   */
  async getRowCount(): Promise<number> {
    return await this.page.locator('tr[data-row-key]').count();
  }

  /**
   * Check if a row containing the given text exists
   */
  async rowExists(text: string): Promise<boolean> {
    const row = this.page.locator(`tr[data-row-key]:has-text("${text}")`);
    return (await row.count()) > 0;
  }

  /**
   * Auto-retrying assertion: row with text is visible
   */
  async expectRowVisible(text: string): Promise<void> {
    await expect(this.page.locator(`tr[data-row-key]:has-text("${text}")`)).toBeVisible();
  }

  /**
   * Auto-retrying assertion: row with text is gone
   */
  async expectRowHidden(text: string): Promise<void> {
    await expect(this.page.locator(`tr[data-row-key]:has-text("${text}")`)).toHaveCount(0);
  }

  /**
   * Auto-retrying assertion: table has no data rows
   */
  async expectEmptyTable(): Promise<void> {
    await expect(this.page.locator('tr[data-row-key]')).toHaveCount(0);
  }

  /**
   * Auto-retrying assertion: validation error is visible
   */
  async expectValidationError(): Promise<void> {
    await expect(this.page.locator('.ant-form-item-explain-error').first()).toBeVisible();
  }

  /**
   * Click the Edit button in a row containing the given text
   */
  async clickEditInRow(text: string): Promise<void> {
    const row = this.page.locator(`tr[data-row-key]:has-text("${text}")`);
    await row.locator('button:has-text("Edit")').click();
    await this.waitForDrawerOpen();
  }

  /**
   * Click the Delete button in a row and confirm the modal
   */
  async deleteRow(text: string): Promise<void> {
    const row = this.page.locator(`tr[data-row-key]:has-text("${text}")`);
    const deleteBtn = row.locator('button.ant-btn-dangerous').first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click();
    // Confirm the modal dialog
    const modal = this.page.locator('.ant-modal-confirm');
    await modal.waitFor({ state: 'visible' });
    await modal.locator('button:has-text("Yes")').click();
    await modal.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Check if any form validation errors are visible
   */
  async hasValidationError(): Promise<boolean> {
    const errorCount = await this.page.locator('.ant-form-item-explain-error').count();
    return errorCount > 0;
  }

  /**
   * Wait for success message (notification or message)
   */
  async waitForSuccess(): Promise<void> {
    await expect(
      this.page.locator('.ant-message-success').first()
    ).toBeVisible({ timeout: 5000 });
  }
}
