import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page object with common Ant Design helpers
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Fill a form item by its label text
   */
  async fillFormItem(label: string, value: string): Promise<void> {
    const formItem = this.page.locator('.ant-form-item').filter({ hasText: label });
    const input = formItem.locator('input, textarea').first();
    await input.fill(value);
  }

  /**
   * Fill a form item by its field name (id attribute)
   */
  async fillFormField(name: string, value: string): Promise<void> {
    await this.page.fill(`input[id="${name}"], textarea[id="${name}"]`, value);
  }

  /**
   * Select an option from an Ant Design Select component
   */
  async selectOption(label: string, optionText: string): Promise<void> {
    const formItem = this.page.locator('.ant-form-item').filter({ hasText: label });
    const select = formItem.locator('.ant-select');
    await select.click();

    // Wait for dropdown and click option
    const option = this.page.locator('.ant-select-item-option').filter({ hasText: optionText });
    await option.click();
  }

  /**
   * Select option by clicking the select and choosing from dropdown
   */
  async selectFromDropdown(selectSelector: string, optionText: string): Promise<void> {
    await this.page.click(selectSelector);
    await this.page.click(`.ant-select-item-option:has-text("${optionText}")`);
  }

  /**
   * Wait for drawer to open with animation
   */
  async waitForDrawerOpen(): Promise<Locator> {
    const drawer = this.page.locator('.ant-drawer');
    await drawer.waitFor({ state: 'visible' });
    // Wait for drawer animation to complete
    await this.page.waitForTimeout(300);
    return drawer;
  }

  /**
   * Wait for drawer to close
   */
  async waitForDrawerClose(): Promise<void> {
    // Wait for drawer-open class to be removed (handles animation)
    await this.page.locator('.ant-drawer-open').waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Wait for table data to load (Meteor subscription)
   */
  async waitForTableLoad(): Promise<void> {
    // Wait for any loading indicators to disappear
    const spinner = this.page.locator('.ant-spin-spinning');
    if (await spinner.isVisible()) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
    // Wait for network to settle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get success notification
   */
  async waitForSuccessNotification(): Promise<void> {
    await expect(this.page.locator('.ant-notification-notice-success, .ant-message-success')).toBeVisible({
      timeout: 5000,
    });
  }

  /**
   * Get error notification
   */
  async waitForErrorNotification(): Promise<void> {
    await expect(this.page.locator('.ant-notification-notice-error, .ant-message-error')).toBeVisible({
      timeout: 5000,
    });
  }

  /**
   * Click submit button in form (handles Submit, Save, etc.)
   */
  async submitForm(): Promise<void> {
    // Try different common submit button patterns
    const submitBtn = this.page.locator('button[type="submit"], .ant-drawer button:has-text("Save"), .ant-drawer button:has-text("Submit")').first();
    await submitBtn.click();
  }

  /**
   * Click cancel button in drawer form
   */
  async cancelForm(): Promise<void> {
    await this.page.click('.ant-drawer button:has-text("Cancel")');
  }

  /**
   * Confirm a popconfirm dialog
   */
  async confirmPopconfirm(): Promise<void> {
    await this.page.click('.ant-popconfirm-buttons button:has-text("Yes")');
  }

  /**
   * Cancel a popconfirm dialog
   */
  async cancelPopconfirm(): Promise<void> {
    await this.page.click('.ant-popconfirm-buttons button:has-text("No")');
  }
}
