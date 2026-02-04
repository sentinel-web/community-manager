import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Login page object
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForSelector('.login');
  }

  /**
   * Fill username field
   */
  async fillUsername(username: string): Promise<void> {
    await this.page.fill('input[id="username"]', username);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.page.fill('input[id="password"]', password);
  }

  /**
   * Click login button
   */
  async clickLogin(): Promise<void> {
    await this.page.click('button[type="submit"]');
  }

  /**
   * Perform full login flow
   */
  async login(username: string, password: string): Promise<void> {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  /**
   * Click register button to open registration modal
   */
  async clickRegister(): Promise<void> {
    await this.page.click('button:has-text("Register")');
  }

  /**
   * Check if login card is visible
   */
  async isLoginCardVisible(): Promise<boolean> {
    return await this.page.locator('.login').isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    const error = this.page.locator('.ant-notification-notice-error .ant-notification-notice-message');
    if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
      return await error.textContent();
    }
    return null;
  }

  /**
   * Wait for successful login (redirect to dashboard)
   */
  async waitForLoginSuccess(): Promise<void> {
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });
  }

  /**
   * Wait for login error
   */
  async waitForLoginError(): Promise<void> {
    await expect(this.page.locator('.ant-notification-notice-error')).toBeVisible({ timeout: 5000 });
  }
}
