import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Sign In');
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'branch.user');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'branch.user');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid username or password')).toBeVisible();
  });

  test('should show error with empty credentials', async ({ page }) => {
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=username and password are required')).toBeVisible();
  });
});

test.describe('Branch User Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as branch user
    await page.goto('/login');
    await page.fill('input[name="username"]', 'branch.user');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display user dashboard with tickets', async ({ page }) => {
    await expect(page.locator('text=My Tickets')).toBeVisible();
    await expect(page.locator('text=Create Ticket')).toBeVisible();
  });

  test('should navigate to create ticket page', async ({ page }) => {
    await page.click('text=Create Ticket');
    await expect(page).toHaveURL(/\/tickets\/new/);
    await expect(page.locator('h1')).toContainText('Create Ticket');
  });
});

test.describe('Create Ticket', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'branch.user');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.click('text=Create Ticket');
    await expect(page).toHaveURL(/\/tickets\/new/);
  });

  test('should create a new ticket successfully', async ({ page }) => {
    await page.fill('input[name="subject"]', 'Test E2E Ticket');
    await page.fill('textarea[name="description"]', 'This is a test ticket created by E2E test');
    await page.selectOption('select[name="category"]', 'Hardware');
    await page.click('button[type="submit"]');
    
    // Should redirect to ticket list or detail
    await expect(page.locator('text=Test E2E Ticket')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=subject, description, and category are required')).toBeVisible();
  });
});

test.describe('Ticket List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'branch.user');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display ticket list', async ({ page }) => {
    await expect(page.locator('text=My Tickets')).toBeVisible();
    // Wait for tickets to load
    await page.waitForTimeout(1000);
  });

  test('should filter tickets by status', async ({ page }) => {
    await page.selectOption('select[name="status"]', 'Pending');
    await page.waitForTimeout(500);
  });
});

test.describe('IT Staff Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'it.staff');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display IT staff dashboard with assigned tickets', async ({ page }) => {
    await expect(page.locator('text=Assigned Tickets')).toBeVisible();
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display admin dashboard with management options', async ({ page }) => {
    await expect(page.locator('text=User Management')).toBeVisible();
    await expect(page.locator('text=Branch Management')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'branch.user');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate via sidebar', async ({ page }) => {
    await page.click('text=Notifications');
    await expect(page).toHaveURL(/\/notifications/);
    
    await page.click('text=Profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should logout successfully', async ({ page }) => {
    // Click user menu and logout
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Logout');
    await expect(page).toHaveURL(/\/login/);
  });
});