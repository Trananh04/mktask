import { test, expect } from '@playwright/test';

test.describe('Delete Task', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  });

  test('should create and then delete a task', async ({ page }) => {
    // Create a new task via modal
    await page.getByRole('button', { name: /^Create Task$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Enter task title')).toBeVisible({ timeout: 5000 });

    const taskTitle = `E2E Delete Test - ${Date.now()}`;
    await page.getByPlaceholder('Enter task title').fill(taskTitle);

    const workspaceBtn = page.getByRole('combobox').filter({ hasText: /^Select workspace$|^Loading workspaces/ });
    await expect(workspaceBtn).toBeEnabled({ timeout: 10000 });
    await workspaceBtn.click();
    await page.locator('[role="option"]').first().click();

    const projectBtn = page.getByRole('combobox').filter({ hasText: /^Select project$|^Loading projects/ });
    await expect(projectBtn).toBeEnabled({ timeout: 10000 });
    await projectBtn.click();
    await page.locator('[role="option"]').first().click();

    const createBtn = page.getByRole('button', { name: /^Create$/ });
    await expect(createBtn).toBeEnabled({ timeout: 10000 });
    await createBtn.click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 15000 });

    // Open task detail panel and delete
    const taskRow = page.locator('.tasktable-row').filter({ hasText: taskTitle });
    await taskRow.click();
    await expect(page.locator('#delete-task-button')).toBeVisible({ timeout: 10000 });

    await page.locator('#delete-task-button').click();
    await expect(page.getByText('Delete Task')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible();

    await page.getByRole('button', { name: /^Delete$/ }).click();

    // Verify task is removed
    await expect(page.locator('#delete-task-button')).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.tasktable-row').filter({ hasText: taskTitle })).not.toBeVisible({ timeout: 10000 });
  });
});
