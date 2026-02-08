import { test, expect } from '@playwright/test';
import { MembersPage } from '../pages/members.page';
import { login } from '../fixtures/auth.fixture';

test.describe('Members', () => {
  let membersPage: MembersPage;

  test.beforeEach(async ({ page }) => {
    await login(page);
    membersPage = new MembersPage(page);
    await membersPage.goto();
  });

  test('should display members table', async ({ page }) => {
    // Should see table with at least the admin user
    const count = await membersPage.getMemberCount();
    expect(count).toBeGreaterThan(0);

    // Should have table headers
    const headerCount = await page.locator('th').count();
    expect(headerCount).toBeGreaterThan(0);
  });

  test('should search members by name', async ({ page }) => {
    // Search for admin
    await membersPage.search('admin');

    // Should show admin user
    await membersPage.expectMemberVisible('admin');

    // Clear and search for non-existent
    await membersPage.clearSearch();
    await membersPage.search('nonexistentuser12345');

    // Should show no results
    await membersPage.expectEmptyTable();
  });

  test('should open create form drawer', async ({ page }) => {
    await membersPage.clickCreate();

    // Drawer should be visible
    await expect(page.locator('.ant-drawer')).toBeVisible();

    // Should have form fields
    await expect(page.locator('input[id="username"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test('should show validation error for empty required fields', async ({ page }) => {
    await membersPage.clickCreate();

    // Clear the username field (form initializes it to empty string, but clear to ensure)
    const usernameInput = page.locator('input[id="username"]');
    await usernameInput.clear();

    // Try to submit without filling required fields
    await membersPage.submitForm();

    // Wait for async validation to complete
    await membersPage.expectValidationError();
  });

  test('should create and delete a member', async ({ page }) => {
    const testId = Math.floor(Math.random() * 8999) + 1000;
    const testUsername = `testuser_${testId}`;
    const testName = `E2E User ${testId}`;

    // Create member
    await membersPage.createMember({
      username: testUsername,
      password: 'testpassword123',
      id: testId.toString(),
      name: testName,
    });

    // Wait for drawer to close
    await membersPage.waitForDrawerClose();

    // Reload page to force fresh subscription (Meteor.users reactive sync can be delayed)
    await page.goto('/members');
    await page.waitForSelector('.ant-table, .ant-empty', { timeout: 15000 });

    // Search by profile name (table shows profile.name, not username)
    await membersPage.search(testName);
    await membersPage.expectMemberVisible(testName);

    // Clean up - delete the member
    await membersPage.deleteMember(testName);

    // Verify member is removed
    await membersPage.expectMemberHidden(testName);
  });

  test('should edit an existing member', async ({ page }) => {
    const testId = Math.floor(Math.random() * 8999) + 1000;
    const testUsername = `edittest_${testId}`;
    const originalName = `E2E Edit ${testId}`;
    const updatedName = `E2E Updated ${testId}`;

    await membersPage.createMember({
      username: testUsername,
      password: 'testpassword123',
      id: testId.toString(),
      name: originalName,
    });

    await membersPage.waitForDrawerClose();

    // Reload page to force fresh subscription (Meteor.users reactive sync can be delayed)
    await page.goto('/members');
    await page.waitForSelector('.ant-table, .ant-empty', { timeout: 15000 });

    // Search by profile name (table displays profile.name, not username)
    await membersPage.search(originalName);
    await membersPage.expectMemberVisible(originalName);

    // Click Edit button on member row
    await membersPage.clickMemberRow(originalName);

    // Update the name (nested field: ['profile', 'name'] -> id="profile_name")
    const nameInput = page.locator('input[id="profile_name"]');
    await nameInput.clear();
    await nameInput.fill(updatedName);
    await membersPage.submitForm();
    await membersPage.waitForDrawerClose();

    // Reload again to see updated name
    await page.goto('/members');
    await page.waitForSelector('.ant-table, .ant-empty', { timeout: 15000 });

    // Verify the name was updated
    await membersPage.search(updatedName);
    await membersPage.expectMemberVisible(updatedName);

    // Clean up
    await membersPage.deleteMember(updatedName);
  });
});
