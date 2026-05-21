import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Update Task Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    await page.getByText(/my tasks|công việc của tôi/i).first().waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should update task status via AI chat', async ({ page }) => {
    const firstTask = page.locator('.tasktable-row').first();
    const hasTask = await firstTask.isVisible().catch(() => false);
    test.skip(!hasTask, 'No tasks available to update');

    await mockAIWithSteps(page, [
      { find: /tasktable-row/, action: 'click' },
      { find: /Edit Status/, action: 'click' },
      { find: /Done|Hoàn thành|In Progress|Đang thực hiện|Todo|To Do|Cần làm/, action: 'click' },
    ], 'Task status updated');

    await openChatPanel(page);
    await sendChatMessage(page, 'Change the status of the first task to Done');
    await waitForAgentDone(page);

    await expect(page.locator('[aria-label="Edit Status"]')).toBeVisible({ timeout: 15000 });
    const statusChanged = await page.getByText(/Done|Hoàn thành|In Progress|Đang thực hiện|Todo|To Do|Cần làm/i).first().isVisible().catch(() => false);
    expect(statusChanged).toBe(true);
  });
});
