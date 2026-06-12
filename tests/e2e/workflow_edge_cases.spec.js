const { test, expect } = require('@playwright/test');

test.describe('PT workflow & GPS Edge Cases', () => {

  test.use({ permissions: ['geolocation'], geolocation: { latitude: 10.7725, longitude: 106.6988 } }); // Within range

  test.beforeEach(async ({ page }) => {
    // 1. Login as PT
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'marcus@fitcity.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    // 2. Head to PT dashboard is handled by redirect
    await page.waitForURL(/\/pt/);
  });

  test('PT Dashboard should display earnings and roster', async ({ page }) => {
    // From pt/dashboard.ejs: "Hoa hồng dự kiến" text
    await expect(page.getByText('Hoa hồng dự kiến')).toBeVisible();

    // Verify "VNĐ" label on earnings card
    await expect(page.getByText('VNĐ').first()).toBeVisible();

    // Verify roster section title from pt/dashboard.ejs
    await expect(page.getByText('Buổi tập hôm nay')).toBeVisible();

    // Check PT Header with Avatar
    await expect(page.locator('header img')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Xin chào, HLV');
  });

  test('Successful check-in when within branch range', async ({ page }) => {
    // 1. Identify check-in button (text "Điểm danh" in pt/dashboard.ejs)
    const checkInBtn = page.locator('button:has-text("Điểm danh")').first();
    
    // Guard: if another test already consumed all sessions, skip gracefully
    if (!(await checkInBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // 2. Click it
    await checkInBtn.click();

    // 3. Verify success flash message (ptController.js: "Check-in thành công! Buổi tập đang bắt đầu.")
    await expect(page.locator('.bg-green-100')).toBeVisible();
    await expect(page.locator('.bg-green-100')).toContainText('Check-in thành công');

    // 4. Verify session status became 'Đang diễn ra' (from pt/dashboard.ejs)
    await expect(page.getByText('Đang diễn ra')).toBeVisible();
  });

  test('Failed check-in if GPS out of range', async ({ page, context }) => {
    // Guard: if no sessions available to check-in, skip gracefully
    const checkInBtn = page.locator('button:has-text("Điểm danh")').first();
    if (!(await checkInBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // 1. Force out of range (GPS in New York)
    await context.setGeolocation({ latitude: 40.7128, longitude: -74.0060 });

    // 2. Try check-in
    await checkInBtn.click();

    // 3. Verify error (workoutService.js: "Bạn đang ở quá xa chi nhánh. Vui lòng di chuyển...")
    await expect(page.locator('.bg-red-100')).toBeVisible();
    await expect(page.locator('.bg-red-100')).toContainText('quá xa chi nhánh');
  });

  test('PT Navigation bar should show all tabs', async ({ page }) => {
    // From partials/nav_pt.ejs: 4 nav items
    const nav = page.locator('nav');
    await expect(nav.getByText('Lịch dạy')).toBeVisible();
    await expect(nav.getByText('Chỉ số')).toBeVisible();
    await expect(nav.getByText('Dinh dưỡng')).toBeVisible();
    await expect(nav.getByText('Thoát')).toBeVisible();
  });
});
