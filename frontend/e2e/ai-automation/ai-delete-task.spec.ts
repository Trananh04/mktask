import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Delete Task', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    await page.getByText(/my tasks|công việc của tôi/i).first().waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should delete a task via AI chat', async ({ page }) => {
    // Create a task first so we don't destroy real data
    await page.getByRole('button', { name: /^Create Task$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Enter task title')).toBeVisible({ timeout: 5000 });

    const taskTitle = `AI Delete Test ${Date.now()}`;
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

    // Now use AI chat to delete it
    const escapedTitle = taskTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await mockAIWithSteps(page, [
      { find: new RegExp(escapedTitle), action: 'click' },
      { find: /delete-task-button|Delete|Xóa/, action: 'click' },
      { find: />Delete<|>Xóa</, action: 'click' },
    ], 'Task deleted successfully');

    await openChatPanel(page);
    await sendChatMessage(page, `Delete the task "${taskTitle}"`);
    await waitForAgentDone(page);

    await page.waitForLoadState('networkidle');
    await expect(page.locator('.tasktable-row').filter({ hasText: taskTitle })).not.toBeVisible({ timeout: 15000 });
  });
});
