import { test, expect } from '@playwright/test';

test.describe('Project Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');

    const projectReady = page.getByText(/projects|dự án/i).first();
    await projectReady.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  });

  test('should display projects list', async ({ page }) => {
    await expect(page).toHaveURL(/\/projects/);

    // Check for project cards in the grid
    const projectCards = page.locator('a[href]').filter({
      has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
    });

    const cardCount = await projectCards.count();

    if (cardCount > 0) {
      await expect(projectCards.first()).toBeVisible({ timeout: 10000 });
    } else {
      const hasEmpty = await page.getByText(/no projects|không có dự án/i).isVisible().catch(() => false);
      const hasPage = await page.getByText(/projects|dự án/i).first().isVisible().catch(() => false);
      expect(hasEmpty || hasPage).toBe(true);
    }
  });

  test('should open new project modal', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project|tạo dự án/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    await createButton.click();
    await expect(page.getByText(/create new project|tạo dự án mới/i)).toBeVisible({ timeout: 10000 });
  });

  test('should create a new project with required fields', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project|tạo dự án/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    await createButton.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    const projectName = `E2E Test Project - ${Date.now()}`;

    // Fill project name using placeholder
    const nameInput = page.getByPlaceholder(/enter project name|nhập tên dự án/i);
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(projectName);

    // Wait for form to be ready
    await page.waitForTimeout(1000);

    // Submit (workspace is now optional after refactor)
    const submitButton = page.getByRole('button', { name: /create project|tạo dự án/i }).last();
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Wait for success toast
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 15000 });

    // Verify project appears in the list (use first() to avoid strict mode violation with toast)
    await page.waitForLoadState('networkidle');
    const projectCard = page.locator('a[href]').filter({ hasText: projectName }).first();
    await expect(projectCard).toBeVisible({ timeout: 15000 });
  });

  test('should not submit project without name', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create project|tạo dự án/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    await createButton.click();
    await expect(page.getByText(/create new project|tạo dự án mới/i)).toBeVisible({ timeout: 10000 });

    const submitButton = page.getByRole('button', { name: /create project|tạo dự án/i }).last();
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  });

  test('should search projects', async ({ page }) => {
    const searchInput = page.locator('input[type="text"]').filter({ hasText: '' }).first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });

    await searchInput.fill('test');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });
  });

  test('should filter projects by status', async ({ page }) => {
    const filterTrigger = page
      .locator('[data-testid="filter-dropdown-trigger"], button:has-text("Filter"), button:has-text("Bộ lọc")')
      .first();
    await expect(filterTrigger).toBeVisible({ timeout: 10000 });

    await filterTrigger.click();
    await page.waitForTimeout(500);

    const statusOption = page.getByText(/status|trạng thái/i).first();
    await expect(statusOption).toBeVisible({ timeout: 10000 });
    await statusOption.click();
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to project when clicking card', async ({ page }) => {
    const projectCard = page
      .locator('a[href]')
      .filter({
        has: page.locator('.content-card-hover, [class*="card"], [class*="entity"]'),
      })
      .first();

    await expect(projectCard).toBeVisible({ timeout: 10000 });

    const href = await projectCard.getAttribute('href');
    await projectCard.click();

    await page.waitForURL(`**${href}**`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });
});
