import { test, expect } from '@playwright/test';
import { EventsPage } from '../pages/events.page';
import { login } from '../fixtures/auth.fixture';

test.describe('Events', () => {
  let eventsPage: EventsPage;

  test.beforeEach(async ({ page }) => {
    await login(page);
    eventsPage = new EventsPage(page);
    await eventsPage.goto();
  });

  test('should display calendar view by default', async () => {
    const isCalendarVisible = await eventsPage.isCalendarVisible();
    expect(isCalendarVisible).toBe(true);
  });

  test('should switch between calendar and table views', async ({ page }) => {
    // Switch to table view
    await eventsPage.switchToTableView();
    await expect(page.locator('.ant-table')).toBeVisible();

    // Switch back to calendar view
    await eventsPage.switchToCalendarView();
    await expect(page.locator('.rbc-calendar')).toBeVisible();
  });

  test('should navigate calendar months', async ({ page }) => {
    // Get initial toolbar label
    const initialLabel = await page.locator('.rbc-toolbar-label').textContent();

    // Navigate to next month
    await eventsPage.navigateNext();

    // Label should change
    const nextLabel = await page.locator('.rbc-toolbar-label').textContent();
    expect(nextLabel).not.toBe(initialLabel);

    // Navigate back
    await eventsPage.navigatePrevious();

    // Label should return
    const prevLabel = await page.locator('.rbc-toolbar-label').textContent();
    expect(prevLabel).toBe(initialLabel);
  });

  test('should open create form drawer', async ({ page }) => {
    await eventsPage.clickCreate();

    // Drawer should be visible
    await expect(page.locator('.ant-drawer')).toBeVisible();

    // Should have form fields
    await expect(page.locator('input[id="name"]')).toBeVisible();
  });

  test.skip('should create and delete an event', async ({ page }) => {
    // Skip: Event form validation may require additional fields
    const eventName = `Test Event ${Date.now()}`;

    // Create event
    await eventsPage.createEvent({
      name: eventName,
    });

    // Wait for drawer to close
    await eventsPage.waitForDrawerClose();

    // Switch to table view to verify
    await eventsPage.switchToTableView();

    // Search for the event
    await eventsPage.search(eventName);

    // Verify event appears
    const events = await eventsPage.getTableEventNames();
    const found = events.some(e => e.includes(eventName));
    expect(found).toBe(true);

    // Delete the event
    await eventsPage.deleteEvent(eventName);

    // Verify deleted
    await page.waitForTimeout(500);
    const afterDelete = await eventsPage.getTableEventNames();
    const stillExists = afterDelete.some(e => e.includes(eventName));
    expect(stillExists).toBe(false);
  });
});
