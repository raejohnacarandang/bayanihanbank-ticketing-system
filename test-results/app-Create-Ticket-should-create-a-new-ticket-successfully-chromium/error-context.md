# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Create Ticket >> should create a new ticket successfully
- Location: e2e\app.spec.ts:73:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Login', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/login');
  6   |   });
  7   | 
  8   |   test('should display login form', async ({ page }) => {
  9   |     await expect(page.locator('h1')).toContainText('Sign In');
  10  |     await expect(page.locator('input[name="username"]')).toBeVisible();
  11  |     await expect(page.locator('input[name="password"]')).toBeVisible();
  12  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  13  |   });
  14  | 
  15  |   test('should login successfully with valid credentials', async ({ page }) => {
  16  |     await page.fill('input[name="username"]', 'branch.user');
  17  |     await page.fill('input[name="password"]', 'password123');
  18  |     await page.click('button[type="submit"]');
  19  |     
  20  |     // Should redirect to dashboard
  21  |     await expect(page).toHaveURL(/\/dashboard/);
  22  |     await expect(page.locator('text=Dashboard')).toBeVisible();
  23  |   });
  24  | 
  25  |   test('should show error with invalid credentials', async ({ page }) => {
  26  |     await page.fill('input[name="username"]', 'branch.user');
  27  |     await page.fill('input[name="password"]', 'wrongpassword');
  28  |     await page.click('button[type="submit"]');
  29  |     
  30  |     await expect(page.locator('text=Invalid username or password')).toBeVisible();
  31  |   });
  32  | 
  33  |   test('should show error with empty credentials', async ({ page }) => {
  34  |     await page.click('button[type="submit"]');
  35  |     
  36  |     await expect(page.locator('text=username and password are required')).toBeVisible();
  37  |   });
  38  | });
  39  | 
  40  | test.describe('Branch User Dashboard', () => {
  41  |   test.beforeEach(async ({ page }) => {
  42  |     // Login as branch user
  43  |     await page.goto('/login');
  44  |     await page.fill('input[name="username"]', 'branch.user');
  45  |     await page.fill('input[name="password"]', 'password123');
  46  |     await page.click('button[type="submit"]');
  47  |     await expect(page).toHaveURL(/\/dashboard/);
  48  |   });
  49  | 
  50  |   test('should display user dashboard with tickets', async ({ page }) => {
  51  |     await expect(page.locator('text=My Tickets')).toBeVisible();
  52  |     await expect(page.locator('text=Create Ticket')).toBeVisible();
  53  |   });
  54  | 
  55  |   test('should navigate to create ticket page', async ({ page }) => {
  56  |     await page.click('text=Create Ticket');
  57  |     await expect(page).toHaveURL(/\/tickets\/new/);
  58  |     await expect(page.locator('h1')).toContainText('Create Ticket');
  59  |   });
  60  | });
  61  | 
  62  | test.describe('Create Ticket', () => {
  63  |   test.beforeEach(async ({ page }) => {
> 64  |     await page.goto('/login');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  65  |     await page.fill('input[name="username"]', 'branch.user');
  66  |     await page.fill('input[name="password"]', 'password123');
  67  |     await page.click('button[type="submit"]');
  68  |     await expect(page).toHaveURL(/\/dashboard/);
  69  |     await page.click('text=Create Ticket');
  70  |     await expect(page).toHaveURL(/\/tickets\/new/);
  71  |   });
  72  | 
  73  |   test('should create a new ticket successfully', async ({ page }) => {
  74  |     await page.fill('input[name="subject"]', 'Test E2E Ticket');
  75  |     await page.fill('textarea[name="description"]', 'This is a test ticket created by E2E test');
  76  |     await page.selectOption('select[name="category"]', 'Hardware');
  77  |     await page.click('button[type="submit"]');
  78  |     
  79  |     // Should redirect to ticket list or detail
  80  |     await expect(page.locator('text=Test E2E Ticket')).toBeVisible();
  81  |   });
  82  | 
  83  |   test('should show validation errors for empty fields', async ({ page }) => {
  84  |     await page.click('button[type="submit"]');
  85  |     
  86  |     await expect(page.locator('text=subject, description, and category are required')).toBeVisible();
  87  |   });
  88  | });
  89  | 
  90  | test.describe('Ticket List', () => {
  91  |   test.beforeEach(async ({ page }) => {
  92  |     await page.goto('/login');
  93  |     await page.fill('input[name="username"]', 'branch.user');
  94  |     await page.fill('input[name="password"]', 'password123');
  95  |     await page.click('button[type="submit"]');
  96  |     await expect(page).toHaveURL(/\/dashboard/);
  97  |   });
  98  | 
  99  |   test('should display ticket list', async ({ page }) => {
  100 |     await expect(page.locator('text=My Tickets')).toBeVisible();
  101 |     // Wait for tickets to load
  102 |     await page.waitForTimeout(1000);
  103 |   });
  104 | 
  105 |   test('should filter tickets by status', async ({ page }) => {
  106 |     await page.selectOption('select[name="status"]', 'Pending');
  107 |     await page.waitForTimeout(500);
  108 |   });
  109 | });
  110 | 
  111 | test.describe('IT Staff Dashboard', () => {
  112 |   test.beforeEach(async ({ page }) => {
  113 |     await page.goto('/login');
  114 |     await page.fill('input[name="username"]', 'it.staff');
  115 |     await page.fill('input[name="password"]', 'password123');
  116 |     await page.click('button[type="submit"]');
  117 |     await expect(page).toHaveURL(/\/dashboard/);
  118 |   });
  119 | 
  120 |   test('should display IT staff dashboard with assigned tickets', async ({ page }) => {
  121 |     await expect(page.locator('text=Assigned Tickets')).toBeVisible();
  122 |   });
  123 | });
  124 | 
  125 | test.describe('Admin Dashboard', () => {
  126 |   test.beforeEach(async ({ page }) => {
  127 |     await page.goto('/login');
  128 |     await page.fill('input[name="username"]', 'admin');
  129 |     await page.fill('input[name="password"]', 'password123');
  130 |     await page.click('button[type="submit"]');
  131 |     await expect(page).toHaveURL(/\/dashboard/);
  132 |   });
  133 | 
  134 |   test('should display admin dashboard with management options', async ({ page }) => {
  135 |     await expect(page.locator('text=User Management')).toBeVisible();
  136 |     await expect(page.locator('text=Branch Management')).toBeVisible();
  137 |   });
  138 | });
  139 | 
  140 | test.describe('Navigation', () => {
  141 |   test.beforeEach(async ({ page }) => {
  142 |     await page.goto('/login');
  143 |     await page.fill('input[name="username"]', 'branch.user');
  144 |     await page.fill('input[name="password"]', 'password123');
  145 |     await page.click('button[type="submit"]');
  146 |     await expect(page).toHaveURL(/\/dashboard/);
  147 |   });
  148 | 
  149 |   test('should navigate via sidebar', async ({ page }) => {
  150 |     await page.click('text=Notifications');
  151 |     await expect(page).toHaveURL(/\/notifications/);
  152 |     
  153 |     await page.click('text=Profile');
  154 |     await expect(page).toHaveURL(/\/profile/);
  155 |   });
  156 | 
  157 |   test('should logout successfully', async ({ page }) => {
  158 |     // Click user menu and logout
  159 |     await page.click('button[aria-label="User menu"]');
  160 |     await page.click('text=Logout');
  161 |     await expect(page).toHaveURL(/\/login/);
  162 |   });
  163 | });
```