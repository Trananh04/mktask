import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithSteps } from './ai-test-helpers';

test.describe('AI Filter Tasks by Priority', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    await page.getByText(/my tasks|công việc của tôi/i).first().waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should filter tasks by high priority via AI chat', async ({ page }) => {
    await mockAIWithSteps(page, [
      { find: /filter-dropdown-trigger/, action: 'click' },
      { find: /Priority/, action: 'click' },
      { find: /High/, action: 'click' },
    ], 'Filtered tasks by High priority');

    await openChatPanel(page);
    await sendChatMessage(page, 'Filter tasks by high priority');
    await waitForAgentDone(page);

    await page.waitForTimeout(2000);
    const filterApplied = await page.locator('[class*="badge"], [class*="chip"]').filter({ hasText: /High|Cao/i }).isVisible().catch(() => false);
    const hasUrlParam = /[?&]priorities=/i.test(page.url());
    expect(filterApplied || hasUrlParam).toBe(true);
  });
});
