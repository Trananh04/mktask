import { test, expect } from '@playwright/test';

test.describe('Task Details & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

    await expect(page.getByText(/my tasks|công việc của tôi/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('should navigate to global tasks view', async ({ page }) => {
    const hasTaskContent = await page.locator('table tbody tr, [class*="Add task"]').first().isVisible().catch(() => false);
    const hasHeader = await page.getByText(/my tasks|công việc của tôi/i).first().isVisible().catch(() => false);
    expect(hasTaskContent || hasHeader).toBe(true);
  });

  test('should view task details by clicking a task row', async ({ page }) => {
    const taskRow = page.locator('.tasktable-row').first();
    const hasTask = await taskRow.isVisible().catch(() => false);
    test.skip(!hasTask, 'No tasks available');

    await taskRow.click();

    const detailSignalA = await page.locator('[aria-label="Edit Status"]').isVisible().catch(() => false);
    const detailSignalB = await page.locator('#delete-task-button').isVisible().catch(() => false);
    const detailSignalC = await page.getByText(/Description|Mô tả|Priority|Ưu tiên/i).first().isVisible().catch(() => false);
    expect(detailSignalA || detailSignalB || detailSignalC).toBe(true);
  });
});
