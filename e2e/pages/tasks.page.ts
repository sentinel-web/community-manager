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
   * Create a new task
   */
  async createTask(data: { name: string; description?: string; status?: string; priority?: string }): Promise<void> {
    await this.clickCreate();

    await this.fillFormField('name', data.name);

    if (data.description) {
      await this.fillFormField('description', data.description);
    }

    if (data.status) {
      await this.selectOption('Status', data.status);
    }

    if (data.priority) {
      await this.selectOption('Priority', data.priority);
    }

    await this.submitForm();
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
    const taskCard = this.page.locator(`.ant-card:has-text("${taskName}")`);
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
   * Delete task by name
   */
  async deleteTaskByName(taskName: string): Promise<void> {
    const taskCard = this.page.locator(`.ant-card:has-text("${taskName}")`);
    await taskCard.locator('button:has-text("Delete")').click();
    await taskCard.waitFor({ state: 'hidden' });
  }

  /**
   * Drag a task to a different column
   */
  async dragTask(taskId: string, toStatusId: string): Promise<void> {
    const source = this.page.locator(`[data-rbd-draggable-id="${taskId}"]`);
    const target = this.page.locator(`[data-rbd-droppable-id="${toStatusId}"]`);

    // Use Playwright's drag and drop
    await source.dragTo(target);

    // Wait for the update to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Drag task by name to column with status name
   */
  async dragTaskByName(taskName: string, toColumnTitle: string): Promise<void> {
    const taskCard = this.page.locator(`.ant-card:has-text("${taskName}")`).first();
    const targetColumn = this.page.locator(`.ant-card:has(.ant-card-head-title:has-text("${toColumnTitle}"))`);

    await taskCard.dragTo(targetColumn);
    await this.page.waitForTimeout(1000);
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
   * Search tasks
   */
  async search(query: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="earch"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.selectFromDropdown('.ant-select:has-text("Status")', status);
  }
}
