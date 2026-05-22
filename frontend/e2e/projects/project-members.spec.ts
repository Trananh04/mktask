import { test, expect } from '@playwright/test';
import { createTestProject, getAuthContext } from '../helpers/test-data';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Project Members', () => {
  let projectSlug: string;

  test.beforeEach(async () => {
    const authFile = path.join(__dirname, '../.auth/user.json');
    const { token, organizationId } = await getAuthContext(authFile);
    const project = await createTestProject(token, organizationId);

    projectSlug = project.slug;
  });

  test('should choose an existing employee when adding a project member', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/members`);
    await page.waitForLoadState('networkidle');

    const inviteButton = page.getByRole('button', { name: /invite|mời/i }).first();
    await expect(inviteButton).toBeVisible({ timeout: 10000 });
    await inviteButton.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('#invite-member')).toBeVisible({ timeout: 10000 });

    const roleSelect = page.locator('button[role="combobox"]').first();
    await expect(roleSelect).toBeVisible({ timeout: 10000 });
    await roleSelect.click();

    const memberOption = page.getByRole('option', { name: /member|thành viên/i }).first();
    await expect(memberOption).toBeVisible({ timeout: 5000 });
    await memberOption.click();

    await expect(page.getByRole('button', { name: /add member|thêm thành viên/i }).last())
      .toBeDisabled();
  });

  test('should display project members list', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/members`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/members/i).first()).toBeVisible({ timeout: 10000 });

    const membersList = page.locator('[class*="member"], [data-testid*="member"]').first();
    await expect(membersList).toBeVisible({ timeout: 10000 });
  });
});
