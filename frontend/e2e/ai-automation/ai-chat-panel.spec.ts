import { test, expect } from '@playwright/test';
import { enableAIChat, openChatPanel, sendChatMessage, waitForAgentDone, mockAIWithDone } from './ai-test-helpers';

test.describe('AI Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    await enableAIChat(page);

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});

    const pageReady = page.getByText(/my tasks|công việc của tôi/i).first();
    await pageReady.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  });

  test('should open chat panel and show welcome screen', async ({ page }) => {
    await openChatPanel(page);

    await expect(page.getByText(/Hi! I'm your mktask AI Assistant|Xin chào! Tôi là trợ lý AI của mktask/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Try these commands:|Thử các lệnh sau:/i)).toBeVisible();
  });

  test('should send a greeting and get AI response', async ({ page }) => {
    await mockAIWithDone(page, 'Hi! How can I help you with mktask today?');
    await openChatPanel(page);
    await sendChatMessage(page, 'Hello');

    await expect(page.getByText('Hello')).toBeVisible({ timeout: 5000 });
    await waitForAgentDone(page);
    await expect(page.getByText('Hi! How can I help you with mktask today?')).toBeVisible({ timeout: 10000 });
  });

  test('should clear chat history and show welcome again', async ({ page }) => {
    await mockAIWithDone(page, 'Hello there!');
    await openChatPanel(page);
    await sendChatMessage(page, 'Hi');
    await waitForAgentDone(page);
    await expect(page.getByText('Hello there!')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Clear|Xóa/i }).click();
    await expect(page.getByText(/Hi! I'm your mktask AI Assistant|Xin chào! Tôi là trợ lý AI của mktask/i)).toBeVisible({ timeout: 5000 });
  });

  test('should disable input while agent is running', async ({ page }) => {
    await page.route('**/ai-chat/chat', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'DONE: Done', success: true }),
      });
    });

    await openChatPanel(page);
    await sendChatMessage(page, 'Do something');

    const textarea = page.getByPlaceholder(/Message AI Assistant\.\.\.|Message Trợ lý AI\.\.\./);
    await expect(textarea).toBeDisabled({ timeout: 5000 });
  });
});
