import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Filter Tasks by Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    await page.getByText(/my tasks|công việc của tôi/i).first().waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should filter tasks by status via AI chat', async ({ page }) => {
    await mockAIWithSteps(page, [
      { find: /filter-dropdown-trigger/, action: 'click' },
      { find: /Status/, action: 'click' },
      { find: /Todo|To Do|Cần làm/, action: 'click' },
    ], 'Filtered tasks by status');

    await openChatPanel(page);
    await sendChatMessage(page, 'Filter tasks by status Todo');
    await waitForAgentDone(page);

    await page.waitForTimeout(2000);
    const filterApplied = await page.locator('[class*="badge"], [class*="chip"]').filter({ hasText: /Todo|To Do|Cần làm/i }).isVisible().catch(() => false);
    const hasUrlParam = /[?&]statuses=/i.test(page.url());
    expect(filterApplied || hasUrlParam).toBe(true);
  });
});
