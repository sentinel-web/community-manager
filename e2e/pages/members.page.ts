import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Members page object for CRUD operations
 */
export class MembersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to members page
   */
  async goto(): Promise<void> {
    await this.page.goto('/members');
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for table or empty state to appear
    await this.page.waitForSelector('.ant-table, .ant-empty', { timeout: 15000 });
  }

  /**
   * Search for members by name
   */
  async search(query: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    await searchInput.fill(query);
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    await searchInput.clear();
  }

  /**
   * Click create button to open member form
   */
  async clickCreate(): Promise<void> {
    await this.page.click('button:has-text("Create")');
    await this.waitForDrawerOpen();
  }

  /**
   * Create a new member
   */
  async createMember(data: { username: string; password: string; id: string; name: string }): Promise<void> {
    await this.clickCreate();

    await this.fillFormField('username', data.username);
    await this.fillFormField('password', data.password);
    // Ant Design uses nested names: ['profile', 'id'] becomes profile_id
    await this.fillFormField('profile_id', data.id);
    await this.fillFormField('profile_name', data.name);

    await this.submitForm();
  }

  /**
   * Click Edit button in a member's row
   */
  async clickMemberRow(name: string): Promise<void> {
    const row = this.page.locator(`tr[data-row-key]:has-text("${name}")`);
    await row.locator('button:not(.ant-btn-link):has-text("Edit")').click();
    await this.waitForDrawerOpen();
  }

  /**
   * Edit a member by name
   */
  async editMember(name: string, updates: { name?: string; squadId?: string }): Promise<void> {
    await this.clickMemberRow(name);

    if (updates.name) {
      await this.fillFormField('name', updates.name);
    }

    await this.submitForm();
  }

  /**
   * Delete a member by clicking delete button in their row and confirming modal
   */
  async deleteMember(name: string): Promise<void> {
    const row = this.page.locator(`tr[data-row-key]:has-text("${name}")`);
    const deleteBtn = row.locator('button.ant-btn-dangerous').first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click();
    const modal = this.page.locator('.ant-modal-confirm');
    await modal.waitFor({ state: 'visible' });
    await modal.locator('button:has-text("Yes")').click();
    await modal.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Get count of members displayed in table
   */
  async getMemberCount(): Promise<number> {
    const rows = await this.page.locator('tr[data-row-key]').count();
    return rows;
  }

  /**
   * Check if a member with given name exists in table
   */
  async memberExists(name: string): Promise<boolean> {
    return await this.page.locator(`tr:has-text("${name}")`).isVisible();
  }

  /**
   * Get member names from table
   */
  async getMemberNames(): Promise<string[]> {
    // Members table typically has username in first column
    const cells = await this.page.locator('tr[data-row-key] td:first-child').allTextContents();
    return cells;
  }

  /**
   * Click load more button if available
   */
  async loadMore(): Promise<void> {
    const loadMoreBtn = this.page.locator('button:has-text("Load")');
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click();
      await this.waitForTableLoad();
    }
  }

  /**
   * Wait for form validation error
   */
  async hasValidationError(): Promise<boolean> {
    const errorCount = await this.page.locator('.ant-form-item-explain-error').count();
    return errorCount > 0;
  }

  /**
   * Auto-retrying assertion: member row is visible
   */
  async expectMemberVisible(name: string): Promise<void> {
    await expect(this.page.locator(`tr[data-row-key]:has-text("${name}")`)).toBeVisible();
  }

  /**
   * Auto-retrying assertion: member row is gone
   */
  async expectMemberHidden(name: string): Promise<void> {
    await expect(this.page.locator(`tr[data-row-key]:has-text("${name}")`)).toHaveCount(0);
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
}
