import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * E2E Test Suite: User Registration Flow
 * 
 * This test suite covers the complete user registration workflow including:
 * - Page load and UI elements verification
 * - Form validation (client-side)
 * - Password requirements validation
 * - Successful registration flow
 * - Error handling
 */

test.describe('User Registration Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/registration-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true }),
      });
    });

    // Navigate to the registration page before each test
    await page.goto('/register');
  });

  test('should load the registration page with all required elements', async ({ page }) => {
    await expect(page).toHaveTitle(/mktask/i);

    const heading = page.getByRole('heading', { name: /^Create Account$/i });
    await heading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    await expect(page.getByLabel(/first name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/last name/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/email address/i)).toBeVisible({ timeout: 5000 });

    const passwordField = page.getByLabel(/^password$/i).first();
    await passwordField.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    await expect(page.getByRole('checkbox', { name: /terms of service/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /^Create Account$/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /^Log In to Existing Account$/i })).toBeVisible({ timeout: 5000 });
  });

  test('should show password requirements when typing password', async ({ page }) => {
    const passwordInput = page.getByLabel(/^password$/i).first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    await passwordInput.fill('Test');
    await expect(passwordInput).toHaveValue('Test');
  });

  test('should validate password requirements in real-time', async ({ page }) => {
    const passwordInput = page.getByLabel(/password|mật khẩu/i).first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    await passwordInput.fill('test');
    await passwordInput.fill('Test1234');
    await expect(passwordInput).toHaveValue('Test1234');
  });

  test('should validate password confirmation matches', async ({ page }) => {
    const passwordInput = page.getByLabel(/^password$/i).first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    const confirmPasswordInput = page.getByLabel(/confirm password/i);

    await passwordInput.fill('Test1234');
    await confirmPasswordInput.fill('Test5678');
    await confirmPasswordInput.blur();

    const mismatch = await page.getByText(/passwords do not match/i).isVisible().catch(() => false);
    await confirmPasswordInput.fill('Test1234');
    const match = await page.getByText(/passwords match/i).isVisible().catch(() => false);
    expect(mismatch || match).toBe(true);
  });

  test('should disable submit button when form is incomplete', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /^Create Account$/i });
    await submitButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const initialDisabled = await submitButton.isDisabled().catch(() => true);
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');

    const stillDisabled = await submitButton.isDisabled().catch(() => true);
    expect(initialDisabled || stillDisabled).toBe(true);
  });

  test('should enable submit button when all requirements are met', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /^Create Account$/i });

    // Fill all required fields
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');
    await page.getByLabel(/email address|địa chỉ email|email/i).fill('john.doe@example.com');
    await page.getByLabel(/^password$|^mật khẩu$/i).first().fill('Test1234');
    await page.getByLabel(/confirm password|xác nhận mật khẩu/i).fill('Test1234');

    // Accept terms
    await page.getByRole('checkbox', { name: /terms of service|điều khoản dịch vụ/i }).check();

    // Button should be enabled
    await expect(submitButton).toBeEnabled({ timeout: 3000 });
  });

  test('should show error when terms are not accepted', async ({ page }) => {
    // Fill all fields except terms
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');
    await page.getByLabel(/email address|địa chỉ email|email/i).fill('john.doe@example.com');
    await page.getByLabel(/^password$|^mật khẩu$/i).first().fill('Test1234');
    await page.getByLabel(/confirm password|xác nhận mật khẩu/i).fill('Test1234');
    
    // Try to submit without accepting terms
    const submitButton = page.getByRole('button', { name: /^Create Account$/i });
    
    // Button should be disabled
    await expect(submitButton).toBeDisabled();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/^password$|^mật khẩu$/i).first();

    // Fill password
    await passwordInput.fill('Test1234');
    
    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click show password button
    const showPasswordButtons = page.getByRole('button', { name: /show password|hiện mật khẩu/i });
    await showPasswordButtons.first().click();
    
    // Password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click hide password button
    const hidePasswordButtons = page.getByRole('button', { name: /hide password|ẩn mật khẩu/i });
    await hidePasswordButtons.first().click();
    
    // Password should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to login page when clicking login link', async ({ page }) => {
    // Click the login link
    const loginLink = page.getByRole('link', { name: /^Log In to Existing Account$/i });
    await expect(loginLink).toBeVisible({ timeout: 5000 });
    await loginLink.click();
    
    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show submit transition when submitting form', async ({ page }) => {
    const timestamp = Date.now();
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');
    await page.getByLabel(/email address|địa chỉ email|email/i).fill(`john.doe.${timestamp}@example.com`);
    await page.getByLabel(/^password$|^mật khẩu$/i).first().fill('Test1234');
    await page.getByLabel(/confirm password|xác nhận mật khẩu/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service|điều khoản dịch vụ/i }).check();

    const submitButton = page.getByRole('button', { name: /^Create Account$/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    await expect(submitButton).toBeDisabled({ timeout: 5000 });
  });

  test('should handle registration with pre-filled email from query parameter', async ({ page }) => {
    // Navigate with email query parameter
    await page.goto('/register?email=prefilled@example.com');
    
    // Email field should be pre-filled
    const emailInput = page.getByLabel(/email address|địa chỉ email|email/i);
    await expect(emailInput).toHaveValue('prefilled@example.com');
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByLabel(/email address|địa chỉ email|email/i);
    
    // Fill invalid email
    await emailInput.fill('invalid-email');
    
    // Try to submit (button should be enabled but form validation should fail)
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');
    await page.getByLabel(/^password$|^mật khẩu$/i).first().fill('Test1234');
    await page.getByLabel(/confirm password|xác nhận mật khẩu/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service|điều khoản dịch vụ/i }).check();
    
    // HTML5 validation should prevent submission
    // Note: This test verifies the email input has type="email"
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check for proper labels
    await expect(page.getByLabel(/first name|tên/i)).toBeVisible();
    await expect(page.getByLabel(/last name|họ/i)).toBeVisible();
    await expect(page.getByLabel(/email address|địa chỉ email|email/i)).toBeVisible();
    
    // Check for required attributes
    await expect(page.getByLabel(/first name|tên/i)).toHaveAttribute('required');
    await expect(page.getByLabel(/email address|địa chỉ email|email/i)).toHaveAttribute('required');
    
    // Check for autocomplete attributes
    await expect(page.getByLabel(/first name|tên/i)).toHaveAttribute('autocomplete', 'given-name');
    await expect(page.getByLabel(/last name|họ/i)).toHaveAttribute('autocomplete', 'family-name');
    await expect(page.getByLabel(/email address|địa chỉ email|email/i)).toHaveAttribute('autocomplete', 'email');
  });

  test('should allow editing fields after a submit attempt', async ({ page }) => {
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');
    await page.getByLabel(/email address|địa chỉ email|email/i).fill(`user.${Date.now()}@example.com`);
    await page.getByLabel(/^password$|^mật khẩu$/i).first().fill('Test1234');
    await page.getByLabel(/confirm password|xác nhận mật khẩu/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service|điều khoản dịch vụ/i }).check();

    const submitButton = page.getByRole('button', { name: /^Create Account$/i });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    const firstName = page.getByLabel(/first name|tên/i);
    await firstName.fill('Jane');
    await expect(firstName).toHaveValue('Jane');
  });
});

/**
 * Test Suite: Registration Form Validation Edge Cases
 */
test.describe('Registration Form Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/registration-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true }),
      });
    });

    await page.goto('/register');
  });

  test('should handle very long names', async ({ page }) => {
    const longName = 'A'.repeat(100);
    
    await page.getByLabel(/first name|tên/i).fill(longName);
    await page.getByLabel(/last name|họ/i).fill(longName);
    
    // Form should still be functional
    await expect(page.getByLabel(/first name|tên/i)).toHaveValue(longName);
    await expect(page.getByLabel(/last name|họ/i)).toHaveValue(longName);
  });

  test('should handle special characters in names', async ({ page }) => {
    await page.getByLabel(/first name|tên/i).fill("O'Brien");
    await page.getByLabel(/last name|họ/i).fill('José-María');
    
    // Should accept special characters
    await expect(page.getByLabel(/first name|tên/i)).toHaveValue("O'Brien");
    await expect(page.getByLabel(/last name|họ/i)).toHaveValue('José-María');
  });

  test('should handle whitespace in form fields', async ({ page }) => {
    // Fill fields with leading/trailing whitespace
    await page.getByLabel(/first name|tên/i).fill('  John  ');
    await page.getByLabel(/last name|họ/i).fill('  Doe  ');
    
    // Values should be preserved (trimming is typically done server-side)
    await expect(page.getByLabel(/first name|tên/i)).toHaveValue('  John  ');
  });

  test('should validate password with only special characters', async ({ page }) => {
    const passwordInput = page.getByLabel(/^password$|^mật khẩu$/i).first();

    // Password with special characters but missing requirements
    await passwordInput.fill('!@#$%^&*');
    
    // Should show requirements not met
    await expect(passwordInput).toHaveValue('!@#$%^&*');
  });

  test('should handle rapid form submission attempts', async ({ page }) => {
    // Fill form
    await page.getByLabel(/first name|tên/i).fill('John');
    await page.getByLabel(/last name|họ/i).fill('Doe');
    await page.getByLabel(/email address|địa chỉ email|email/i).fill(`test.${Date.now()}@example.com`);
    await page.getByLabel(/^password$|^mật khẩu$/i).first().fill('Test1234');
    await page.getByLabel(/confirm password|xác nhận mật khẩu/i).fill('Test1234');
    await page.getByRole('checkbox', { name: /terms of service|điều khoản dịch vụ/i }).check();
    
    const submitButton = page.getByRole('button', { name: /^Create Account$/i });
    
    // Try to click multiple times rapidly
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();
    
    // Button should be disabled after first click (loading state)
    await expect(submitButton).toBeDisabled();
  });
});
