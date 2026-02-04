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
    // Wait for reactive update
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    await searchInput.clear();
    await this.page.waitForTimeout(500);
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
   * Click on a member row to edit
   */
  async clickMemberRow(name: string): Promise<void> {
    await this.page.click(`tr:has-text("${name}")`);
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
   * Delete a member by clicking delete button in their row
   */
  async deleteMember(name: string): Promise<void> {
    const row = this.page.locator(`tr:has-text("${name}")`);
    await row.locator('button[danger], button:has-text("Delete")').click();
    await this.confirmPopconfirm();
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
}
