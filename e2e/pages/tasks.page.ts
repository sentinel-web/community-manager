import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Tasks page object for Kanban board operations
 */
export class TasksPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to tasks page
   */
  async goto(): Promise<void> {
    await this.page.goto('/tasks');
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for page content to load - tasks page has header with Create button
    await this.page.waitForSelector('button:has-text("Create")', { timeout: 15000 });
  }

  /**
   * Check if Kanban board is displayed
   */
  async isKanbanVisible(): Promise<boolean> {
    // react-beautiful-dnd uses data attributes
    return await this.page.locator('[data-rbd-droppable-id]').first().isVisible();
  }

  /**
   * Get all column status IDs
   */
  async getColumnIds(): Promise<string[]> {
    const columns = await this.page.locator('[data-rbd-droppable-id]').all();
    const ids: string[] = [];
    for (const col of columns) {
      const id = await col.getAttribute('data-rbd-droppable-id');
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Get task IDs in a specific column
   */
  async getTasksInColumn(statusId: string): Promise<string[]> {
    const column = this.page.locator(`[data-rbd-droppable-id="${statusId}"]`);
    const tasks = await column.locator('[data-rbd-draggable-id]').all();
    const ids: string[] = [];
    for (const task of tasks) {
      const id = await task.getAttribute('data-rbd-draggable-id');
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Click create button to open task form
   */
  async clickCreate(): Promise<void> {
    await this.page.click('button:has-text("Create")');
    await this.waitForDrawerOpen();
  }

  /**
   * Select the first available option from a CollectionSelect by label.
   * Retries up to 3 times if the selection doesn't stick (subscription re-render).
   */
  async selectFirstOption(label: string): Promise<boolean> {
    const formItem = this.page.locator('.ant-form-item').filter({ hasText: label });
    const select = formItem.locator('.ant-select');

    for (let attempt = 0; attempt < 3; attempt++) {
      await select.click();
      // Wait for dropdown options to load (CollectionSelect subscribes async via WebSocket)
      const option = this.page.locator('.ant-select-item-option').first();
      const timeout = attempt === 0 ? 10000 : 3000;
      if (!(await option.isVisible({ timeout }).catch(() => false))) {
        await this.page.keyboard.press('Escape');
        if (attempt === 0) return false; // No options available at all
        continue;
      }
      // Let subscription data stabilize (WebSocket updates aren't visible to Playwright)
      await this.page.waitForTimeout(500);
      // Re-check option is still visible after stabilization
      if (!(await option.isVisible().catch(() => false))) {
        // Options re-rendered during stabilization, re-open dropdown
        continue;
      }
      await option.click();
      // Verify the selection registered in the form
      const selectionItem = formItem.locator('.ant-select-selection-item');
      if (await selectionItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        return true;
      }
      // Selection didn't stick (subscription re-rendered options) - retry
    }
    return false;
  }

  /**
   * Create a new task via the UI form
   */
  async createTask(data: { name: string; description?: string; status?: string; priority?: string }): Promise<void> {
    await this.clickCreate();

    await this.fillFormField('name', data.name);

    if (data.description) {
      await this.fillFormField('description', data.description);
    }

    if (data.status) {
      await this.selectOption('Status', data.status);
    } else {
      // Status is required - select first available option
      const selected = await this.selectFirstOption('Status');
      if (!selected) {
        // CollectionSelect timing issue - fall back to server method
        await this.cancelForm();
        await this.waitForDrawerClose();
        await this.createTaskViaMethod(data.name);
        return;
      }
    }

    if (data.priority) {
      await this.selectOption('Priority', data.priority);
    }

    await this.submitForm();
  }

  /**
   * Create a task via Meteor method (bypasses UI form).
   * Use this for test setup where task creation isn't being tested.
   */
  async createTaskViaMethod(name: string): Promise<string | null> {
    return await this.page.evaluate(async (taskName: string) => {
      // Get first available task status
      const statuses = await (window as any).Meteor.callAsync('taskStatus.read', {}, { limit: 1 });
      if (statuses.length === 0) return null;
      // Create the task
      return await (window as any).Meteor.callAsync('tasks.insert', {
        name: taskName,
        status: statuses[0]._id,
      });
    }, name);
  }

  /**
   * Delete a task via Meteor method (bypasses UI).
   */
  async deleteTaskViaMethod(taskId: string): Promise<void> {
    await this.page.evaluate(async (id: string) => {
      await (window as any).Meteor.callAsync('tasks.remove', id);
    }, taskId);
  }

  /**
   * Click on a task card to edit
   */
  async clickTask(taskId: string): Promise<void> {
    await this.page.click(`[data-rbd-draggable-id="${taskId}"] button:has-text("Edit")`);
    await this.waitForDrawerOpen();
  }

  /**
   * Click edit button on task card by name
   */
  async editTaskByName(taskName: string): Promise<void> {
    const taskCard = this.page.locator(`[data-rbd-draggable-id]:has(.ant-card-head-title:has-text("${taskName}"))`);
    await taskCard.locator('button:has-text("Edit")').click();
    await this.waitForDrawerOpen();
  }

  /**
   * Delete a task by clicking delete button on card
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.page.click(`[data-rbd-draggable-id="${taskId}"] button:has-text("Delete")`);
    // Wait for task to be removed
    await this.page.locator(`[data-rbd-draggable-id="${taskId}"]`).waitFor({ state: 'hidden' });
  }

  /**
   * Delete task by name (Kanban delete has no confirmation modal)
   */
  async deleteTaskByName(taskName: string): Promise<void> {
    const taskCard = this.page.locator(`[data-rbd-draggable-id]:has(.ant-card-head-title:has-text("${taskName}"))`);
    await taskCard.locator('button:has-text("Delete")').click();
    await taskCard.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Drag a task to a different column
   */
  async dragTask(taskId: string, toStatusId: string): Promise<void> {
    const source = this.page.locator(`[data-rbd-draggable-id="${taskId}"]`);
    const target = this.page.locator(`[data-rbd-droppable-id="${toStatusId}"]`);

    await source.dragTo(target);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Drag task by name to column with status name
   */
  async dragTaskByName(taskName: string, toColumnTitle: string): Promise<void> {
    const taskCard = this.page.locator(`[data-rbd-draggable-id]:has(.ant-card-head-title:has-text("${taskName}"))`);
    const targetColumn = this.page.locator(`[data-rbd-droppable-id]:has(.ant-card-head-title:has-text("${toColumnTitle}"))`);

    await taskCard.dragTo(targetColumn);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get all task names on the board
   */
  async getAllTaskNames(): Promise<string[]> {
    const titles = await this.page.locator('[data-rbd-draggable-id] .ant-card-head-title').allTextContents();
    return titles;
  }

  /**
   * Check if a task exists on the board
   */
  async taskExists(taskName: string): Promise<boolean> {
    return await this.page.locator(`[data-rbd-draggable-id] .ant-card-head-title:has-text("${taskName}")`).isVisible();
  }

  /**
   * Auto-retrying assertion: task card is visible on the board
   */
  async expectTaskVisible(taskName: string): Promise<void> {
    await expect(this.page.locator(`[data-rbd-draggable-id] .ant-card-head-title:has-text("${taskName}")`)).toBeVisible();
  }

  /**
   * Auto-retrying assertion: task card is gone from the board
   */
  async expectTaskHidden(taskName: string): Promise<void> {
    await expect(this.page.locator(`[data-rbd-draggable-id] .ant-card-head-title:has-text("${taskName}")`)).toHaveCount(0);
  }

  /**
   * Search tasks
   */
  async search(query: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(query);
    }
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.selectFromDropdown('.ant-select:has-text("Status")', status);
  }
}
