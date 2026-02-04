import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Navigation component page object
 */
export class NavigationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Open the navigation dropdown menu
   */
  async openMenu(): Promise<void> {
    await this.page.click('nav button');
    await this.page.waitForSelector('[role="menu"]', { state: 'visible' });
  }

  /**
   * Close the navigation dropdown menu
   */
  async closeMenu(): Promise<void> {
    // Click outside to close
    await this.page.click('body', { position: { x: 10, y: 10 } });
    await this.page.locator('[role="menu"]').waitFor({ state: 'hidden' });
  }

  /**
   * Navigate to a section by clicking menu item
   */
  async navigateTo(section: string): Promise<void> {
    await this.openMenu();
    await this.page.click(`[role="menuitem"]:has-text("${section}")`);
    // Wait for navigation to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of visible menu items
   */
  async getVisibleMenuItems(): Promise<string[]> {
    await this.openMenu();
    const items = await this.page.locator('[role="menuitem"]').allTextContents();
    await this.closeMenu();
    return items;
  }

  /**
   * Check if a menu item is visible
   */
  async isMenuItemVisible(section: string): Promise<boolean> {
    await this.openMenu();
    const isVisible = await this.page.locator(`[role="menuitem"]:has-text("${section}")`).isVisible();
    await this.closeMenu();
    return isVisible;
  }

  /**
   * Get current path
   */
  getCurrentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  /**
   * Wait for navigation button to be visible (indicates authenticated)
   */
  async waitForNavigationReady(): Promise<void> {
    await expect(this.page.locator('nav button')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Click logout button (in user dropdown)
   */
  async logout(): Promise<void> {
    // Click on the user dropdown at bottom left - has down arrow icon
    const userDropdown = this.page.locator('text=Admin >> xpath=ancestor::*[contains(@class, "dropdown")]').first();
    if (await userDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userDropdown.click();
    } else {
      // Fallback: click the admin text area that has the down arrow
      await this.page.locator('.ant-dropdown-trigger:has-text("Admin")').first().click();
    }
    await this.page.waitForSelector('[role="menu"], .ant-dropdown', { timeout: 5000 });
    await this.page.click('text=Logout');
    await this.page.waitForSelector('.login', { timeout: 10000 });
  }
}
