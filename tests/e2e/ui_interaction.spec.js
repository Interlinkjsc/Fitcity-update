const { test, expect } = require('@playwright/test');

test.describe('UI Interactions & Visuals', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'jd@user.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
  });

  test('Notification bell should be visible on client dashboard', async ({ page }) => {
    // From DOM snapshot: button "notifications" exists
    const bell = page.getByRole('button', { name: 'notifications' });
    await expect(bell).toBeVisible();
  });

  test('Client Dashboard shows exercise section', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('FITCITY');
    await expect(page.locator('img[alt="User Profile"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bài tập hàng ngày' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Thư viện bài tập' })).toBeVisible();
  });

  test('Client Progress page renders correctly', async ({ page }) => {
    await page.goto('/client/progress');

    // Title always visible
    await expect(page.locator('h1')).toContainText('KẾT QUẢ');
    await expect(page.locator('h1')).toContainText('TẬP LUYỆN');

    // Check for data or empty state
    const hasData = await page.locator('#radarChart').isVisible().catch(() => false);
    if (hasData) {
      await expect(page.getByText('Cân nặng hiện tại')).toBeVisible();
      await expect(page.getByText('Chỉ số BMI')).toBeVisible();
    } else {
      await expect(page.getByText('CHƯA CÓ DỮ LIỆU INBODY')).toBeVisible();
    }
  });

  test('Client bottom navigation has all links', async ({ page }) => {
    // Each nav item is an accessible link with combined icon+text name
    await expect(page.getByRole('link', { name: /Home/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Train/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Food/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Stats/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Exit/ })).toBeVisible();
  });
});
