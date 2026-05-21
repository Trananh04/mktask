import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Create Task', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    await page.getByText(/my tasks|công việc của tôi/i).first().waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should create a task via AI chat', async ({ page }) => {
    const taskTitle = `AI Task ${Date.now()}`;

    await mockAIWithSteps(page, [
      { find: /[Cc]reate [Tt]ask|[Cc]reate new [Tt]ask/, action: 'click' },
      { find: /Enter task title|placeholder="Enter task title"/, action: 'type', text: taskTitle },
      { find: /Select workspace|Loading workspaces/, action: 'click' },
      { find: /Workspace|role="option"/, action: 'click' },
      { find: /Select project|Loading projects/, action: 'click' },
      { find: /Project|role="option"/, action: 'click' },
      { find: />Create</, action: 'click' },
    ], 'Task created successfully');

    await openChatPanel(page);
    await sendChatMessage(page, `Create a task called ${taskTitle}`);
    await waitForAgentDone(page);

    await page.waitForLoadState('networkidle');
    const taskVisible = await page.getByText(taskTitle).isVisible().catch(() => false);
    expect(taskVisible).toBe(true);
  });
});
