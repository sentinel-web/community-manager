import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Events page object for calendar and event management
 */
export class EventsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to events page
   */
  async goto(): Promise<void> {
    await this.page.goto('/events');
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for calendar or table to appear
    await this.page.waitForSelector('.rbc-calendar, .ant-table', { timeout: 15000 });
  }

  /**
   * Check if calendar view is displayed
   */
  async isCalendarVisible(): Promise<boolean> {
    return await this.page.locator('.rbc-calendar').isVisible();
  }

  /**
   * Check if table view is displayed
   */
  async isTableVisible(): Promise<boolean> {
    return await this.page.locator('table.ant-table-content, .ant-table').isVisible();
  }

  /**
   * Switch to calendar view
   */
  async switchToCalendarView(): Promise<void> {
    // Click the view dropdown and select Calendar
    await this.page.click('.ant-select:has-text("Table"), .ant-select:has-text("Calendar")');
    await this.page.click('.ant-select-item-option:has-text("Calendar")');
    await expect(this.page.locator('.rbc-calendar')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Switch to table view
   */
  async switchToTableView(): Promise<void> {
    // Click the view dropdown and select Table
    await this.page.click('.ant-select:has-text("Calendar"), .ant-select:has-text("Table")');
    await this.page.click('.ant-select-item-option:has-text("Table")');
    await expect(this.page.locator('.ant-table')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Navigate calendar to next month/week
   */
  async navigateNext(): Promise<void> {
    await this.page.click('.rbc-btn-group button:has-text("Next")');
  }

  /**
   * Navigate calendar to previous month/week
   */
  async navigatePrevious(): Promise<void> {
    await this.page.click('.rbc-btn-group button:has-text("Back")');
  }

  /**
   * Navigate calendar to today
   */
  async navigateToday(): Promise<void> {
    await this.page.click('.rbc-btn-group button:has-text("Today")');
  }

  /**
   * Switch calendar view type (month, week, day, agenda)
   */
  async setCalendarView(view: 'month' | 'week' | 'day' | 'agenda'): Promise<void> {
    const viewLabels: Record<string, string> = {
      month: 'Month',
      week: 'Week',
      day: 'Day',
      agenda: 'Agenda',
    };
    await this.page.click(`.rbc-btn-group button:has-text("${viewLabels[view]}")`);
  }

  /**
   * Click create button to open event form
   */
  async clickCreate(): Promise<void> {
    await this.page.click('button:has-text("Create")');
    await this.waitForDrawerOpen();
  }

  /**
   * Create a new event
   */
  async createEvent(data: { name: string; start?: string; end?: string; eventType?: string }): Promise<void> {
    await this.clickCreate();

    await this.fillFormField('name', data.name);

    // Date pickers require special handling
    if (data.start) {
      const startPicker = this.page.locator('#start');
      await startPicker.click();
      await startPicker.fill(data.start);
      await this.page.keyboard.press('Enter');
    }

    if (data.end) {
      const endPicker = this.page.locator('#end');
      await endPicker.click();
      await endPicker.fill(data.end);
      await this.page.keyboard.press('Enter');
    }

    if (data.eventType) {
      await this.selectOption('Event Type', data.eventType);
    }

    await this.submitForm();
  }

  /**
   * Click on an event in calendar
   */
  async clickEvent(eventName: string): Promise<void> {
    await this.page.click(`.rbc-event:has-text("${eventName}")`);
    await this.waitForDrawerOpen();
  }

  /**
   * Click on an event in table view
   */
  async clickEventInTable(eventName: string): Promise<void> {
    await this.page.click(`tr:has-text("${eventName}")`);
    await this.waitForDrawerOpen();
  }

  /**
   * Delete an event from table view
   */
  async deleteEvent(eventName: string): Promise<void> {
    const row = this.page.locator(`tr:has-text("${eventName}")`);
    await row.locator('button[danger], button:has-text("Delete")').click();
    await this.confirmPopconfirm();
  }

  /**
   * Get event names from calendar view
   */
  async getCalendarEventNames(): Promise<string[]> {
    return await this.page.locator('.rbc-event-content').allTextContents();
  }

  /**
   * Get event names from table view
   */
  async getTableEventNames(): Promise<string[]> {
    return await this.page.locator('tr[data-row-key] td:first-child').allTextContents();
  }

  /**
   * Search events in table view
   */
  async search(query: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    await searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by event type
   */
  async filterByEventType(eventType: string): Promise<void> {
    await this.selectFromDropdown('.ant-select:has-text("Event Type")', eventType);
  }
}
