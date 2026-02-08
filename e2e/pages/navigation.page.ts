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
   * Click logout button (in Footer's dropdown)
   * Footer has a Button type="text" with DownOutlined icon that triggers a dropdown menu.
   */
  async logout(): Promise<void> {
    // The footer (Layout.Footer → <footer class="ant-layout-footer">) has a text button with a down arrow icon
    const downBtn = this.page.locator('.ant-layout-footer button.ant-btn-text').first();
    await downBtn.click();
    // Wait for the dropdown menu to appear
    await this.page.waitForSelector('.ant-dropdown-menu', { timeout: 5000 });
    // Click the Logout menu item (it has danger: true)
    await this.page.locator('.ant-dropdown-menu-item-danger').click();
    // Wait for login page to appear
    await this.page.waitForSelector('.login', { timeout: 10000 });
  }
}
