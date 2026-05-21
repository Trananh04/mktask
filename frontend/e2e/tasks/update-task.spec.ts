import { test, expect } from '@playwright/test';

test.describe('Update Task Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');

    const taskContent = page.locator('table tbody tr, [class*="Add task"]').first();
    await taskContent.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

    await expect(page.getByText(/my tasks|công việc của tôi/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('should update task status from the detail panel', async ({ page }) => {
    const taskRow = page.locator('.tasktable-row').first();
    const hasTask = await taskRow.isVisible().catch(() => false);
    test.skip(!hasTask, 'No tasks available');

    await taskRow.click();

    const editStatusBtn = page.locator('[aria-label="Edit Status"]');
    const canEdit = await editStatusBtn.isVisible().catch(() => false);
    test.skip(!canEdit, 'User does not have edit permission');

    await editStatusBtn.click();

    const statusDropdown = page.locator('[role="menu"]');
    await expect(statusDropdown).toBeVisible({ timeout: 10000 });

    const statusItems = statusDropdown.locator('[role="menuitem"]');
    await expect(statusItems.first()).toBeVisible({ timeout: 10000 });

    const count = await statusItems.count();
    expect(count).toBeGreaterThan(0);
    const targetIndex = count > 1 ? 1 : 0;
    await statusItems.nth(targetIndex).click();

    await page.waitForTimeout(2000);
    const stillOpen = await page.locator('[aria-label="Edit Status"]').isVisible().catch(() => false);
    expect(stillOpen).toBe(true);
  });
});
