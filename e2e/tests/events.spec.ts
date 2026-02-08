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

  test('should create and delete an event', async ({ page }) => {
    const eventName = `Test Event ${Date.now()}`;

    // Create event with required start and end dates
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

    await eventsPage.createEvent({
      name: eventName,
      start: formatDate(now),
      end: formatDate(later),
    });

    // Wait for drawer to close
    await eventsPage.waitForDrawerClose();

    // Switch to table view to verify
    await eventsPage.switchToTableView();

    // Search for the event
    await eventsPage.search(eventName);

    // Verify event appears (auto-retrying)
    await eventsPage.expectEventInTable(eventName);

    // Delete the event via UI
    await eventsPage.deleteEvent(eventName);

    // Verify event is removed (auto-retrying)
    await eventsPage.expectEventNotInTable(eventName);
  });
});
