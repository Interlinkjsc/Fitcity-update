const { test, expect } = require('@playwright/test');

test.describe('Authentication & Dashboard Access', () => {
  
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  });

  test('SA Admin should login and see full sidebar navigation', async ({ page, isMobile }) => {
    if (isMobile) test.skip(); // Admin dashboard not optimized for mobile menu
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Đăng nhập/);

    await page.fill('input[name="email"]', 'admin@fitcity.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/admin/);
    await expect(page.locator('h1')).toContainText('FITCITY');

    // Verify all 9 sidebar links by role (from header.ejs)
    await expect(page.getByRole('link', { name: 'Bảng điều khiển' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quản lý Leads (Marketing)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quản lý Gói tập' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quản lý Chi nhánh' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quản lý Nhân sự (HR)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hợp đồng & Doanh Thu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bảng lương & Thưởng' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sổ chi nội bộ' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Khuyến mãi & Coupon' })).toBeVisible();

    // Verify Logout
    await expect(page.getByText('Đăng xuất').first()).toBeVisible();
  });

  test('PT should login and see trainer dashboard with greeting', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'marcus@fitcity.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/pt/);
    await expect(page.locator('h1')).toContainText('Xin chào, HLV');
    await expect(page.locator('h1')).toContainText('Thorne');

    // Verify PT bottom nav (from partials/nav_pt.ejs)
    await expect(page.getByRole('link', { name: /Lịch dạy/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Chỉ số/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Dinh dưỡng/ })).toBeVisible();
  });

  test('Client should login and see dashboard and bottom nav', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'jd@user.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/client/);
    await expect(page.locator('h1')).toContainText('FITCITY');

    // Verify Client Bottom Nav (accessible links from client/dashboard.ejs)
    await expect(page.getByRole('link', { name: /Home/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Train/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Food/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Stats/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Exit/ })).toBeVisible();
  });

  test('Should show visual error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'wrong@user.com');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // login.ejs shows error in a div (no specific CSS class selector needed, use text)
    await expect(page.getByText('không chính xác')).toBeVisible();
  });
});
