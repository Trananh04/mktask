import { test, expect } from '@playwright/test';
import { createTestProject, getAuthContext } from '../helpers/test-data';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Task Creation', () => {
  let projectSlug: string;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const authFile = path.join(__dirname, '../.auth/user.json');
    const { token, organizationId } = await getAuthContext(authFile);
    const project = await createTestProject(token, organizationId);

    projectSlug = project.slug;
    projectId = project.id;
  });

  test('should create a new task with required fields', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/tasks`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/tasks|công việc/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /create task|tạo công việc/i }).click();
    await page.waitForURL(`**/projects/${projectSlug}/tasks/new**`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const taskTitle = `E2E Test Task - ${Date.now()}`;
    await page.getByLabel(/task title|tiêu đề công việc/i).fill(taskTitle);

    const submitButton = page.getByRole('button', { name: /create task|tạo công việc/i });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    await expect(page.getByText(/created successfully|tạo thành công/i)).toBeVisible({ timeout: 15000 });
  });

  test('should not submit task without a title', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/tasks`);
    await page.waitForLoadState('networkidle');
    await page.goto(`/projects/${projectSlug}/tasks/new`);
    await page.waitForLoadState('networkidle');

    const submitButton = page.getByRole('button', { name: /create task|tạo công việc/i });
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  });

  test('should create a task with HIGH priority', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/tasks`);
    await page.waitForLoadState('networkidle');
    await page.goto(`/projects/${projectSlug}/tasks/new`);
    await page.waitForLoadState('networkidle');

    const taskTitle = `E2E High Priority Task - ${Date.now()}`;
    await page.getByLabel(/task title|tiêu đề công việc/i).fill(taskTitle);

    const prioritySelect = page.locator('label:has-text("Priority"), label:has-text("Ưu tiên")').locator('..').locator('button[role="combobox"]');
    await prioritySelect.click();
    await page.getByRole('option', { name: /high|cao/i }).first().click();

    const submitButton = page.getByRole('button', { name: /create task|tạo công việc/i });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    await page.waitForURL(`**/projects/${projectSlug}/tasks**`, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 15000 });
  });
});
