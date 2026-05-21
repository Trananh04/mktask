import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Open Task Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    await page.getByText(/my tasks|công việc của tôi/i).first().waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should open task detail panel via AI chat', async ({ page }) => {
    const hasTask = await page.locator('.tasktable-row').first().isVisible().catch(() => false);
    test.skip(!hasTask, 'No tasks available to open');

    await mockAIWithSteps(page, [
      { find: /tasktable-row/, action: 'click' },
    ], 'Task details opened');

    await openChatPanel(page);
    await sendChatMessage(page, 'Open the first task');
    await waitForAgentDone(page);

    const detailSignalA = await page.locator('[aria-label="Edit Status"]').isVisible().catch(() => false);
    const detailSignalB = await page.locator('#delete-task-button').isVisible().catch(() => false);
    const detailSignalC = await page.getByText(/Description|Mô tả|Priority|Ưu tiên|Status|Trạng thái/i).first().isVisible().catch(() => false);
    expect(detailSignalA || detailSignalB || detailSignalC).toBe(true);
  });
});
