import { test, expect } from '@playwright/test';
import { createTestProject, getAuthContext } from '../helpers/test-data';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Project Members', () => {
  let projectSlug: string;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const authFile = path.join(__dirname, '../.auth/user.json');
    const { token, organizationId } = await getAuthContext(authFile);
    const project = await createTestProject(token, organizationId);

    projectSlug = project.slug;
    projectId = project.id;
  });

  test('should invite a member to project', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/members`);
    await page.waitForLoadState('networkidle');

    // Click invite button
    const inviteButton = page.getByRole('button', { name: /invite|mời/i }).first();
    await expect(inviteButton).toBeVisible({ timeout: 10000 });
    await inviteButton.click();

    // Wait for invite modal
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/invite member|mời thành viên/i)).toBeVisible({ timeout: 10000 });

    // Fill email
    const emailInput = page.locator('#invite-email, input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    const testEmail = `test-${Date.now()}@example.com`;
    await emailInput.fill(testEmail);

    // Select role
    const roleSelect = page.locator('button[role="combobox"]').filter({ hasText: /select role|chọn vai trò/i }).first();
    await expect(roleSelect).toBeVisible({ timeout: 10000 });
    await roleSelect.click();
    await page.waitForTimeout(500);

    const memberOption = page.getByRole('option', { name: /member|thành viên/i }).first();
    await expect(memberOption).toBeVisible({ timeout: 5000 });
    await memberOption.click();

    // Submit invitation
    const submitButton = page.getByRole('button', { name: /send invitation|gửi lời mời/i }).last();
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Verify success
    await expect(page.getByText(/invitation sent|đã gửi lời mời/i)).toBeVisible({ timeout: 15000 });
  });

  test('should display project members list', async ({ page }) => {
    await page.goto(`/projects/${projectSlug}/members`);
    await page.waitForLoadState('networkidle');

    // Check for members section
    await expect(page.getByText(/members|thành viên/i).first()).toBeVisible({ timeout: 10000 });

    // Verify at least one member exists (the creator/owner)
    const membersList = page.locator('[class*="member"], [data-testid*="member"]').first();
    await expect(membersList).toBeVisible({ timeout: 10000 });
  });
});
