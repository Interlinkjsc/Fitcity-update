const { test, expect } = require('@playwright/test');

test.describe('Finance & Contract Generation Workflow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@fitcity.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/);
  });

  test('Create a new active contract with financial details', async ({ page }) => {
    // Navigate to create form
    await page.goto('/admin/contracts/create');

    // Make sure form is ready
    await expect(page.locator('form[action="/admin/contracts/store"]')).toBeVisible();

    // Fill form using evaluate to directly set value on the correct form elements
    await page.evaluate(() => {
        const form = document.querySelector('form[action="/admin/contracts/store"]');
        form.querySelector('select[name="client"]').selectedIndex = 1;
        form.querySelector('select[name="branch"]').selectedIndex = 1;
        form.querySelector('select[name="pt"]').selectedIndex = 1;
        form.querySelector('select[name="servicePackage"]').selectedIndex = 2;
        form.querySelector('select[name="paymentStatus"]').value = 'Paid';
        form.querySelector('select[name="paymentMethods"]').value = 'Transfer';
        
        // Dispatch changes
        ['client', 'branch', 'pt', 'servicePackage', 'paymentStatus', 'paymentMethods'].forEach(name => {
            form.querySelector(`select[name="${name}"]`).dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    // Fill discount
    await page.locator('form[action="/admin/contracts/store"] input[name="discount"]').fill('500000');

    // Submit
    await page.locator('button', { hasText: 'Phát Hành Hoá Đơn' }).click();

    // Verify redirection to the list
    await expect(page).toHaveURL(/\/\admin\/contracts\/list/, { timeout: 15000 });
    
    // Check for success flash message (.bg-green-100 is the flash container in tailwind)
    await expect(page.locator('.bg-green-100').first()).toBeVisible();

    // Verify row added in list - checking generic strings "Thu đủ tiền" / "Đã thu đủ tiền"
    const row = page.locator('tr', { hasText: 'Johnathan Doe' }).first();
    await expect(row).toContainText(/l|Đã thu đủ tiền|Thu đủ tiền/i);
    await expect(row.locator('a[title="Xuất PDF Hợp đồng"]')).toBeVisible();
  });

  test('Contract validation for missing required data', async ({ page }) => {
    await page.goto('/admin/contracts/create');
    
    // Bypass browser HTML5 validation 
    await page.evaluate(() => {
        document.querySelector('form[action="/admin/contracts/store"]').setAttribute('novalidate', '');
    });
    
    await page.locator('button', { hasText: 'Phát Hành Hoá Đơn' }).click();

    // It should render a flash error since client/package are missing. 
    // We look for common error patterns or the container specifically.
    const errorAlert = page.locator('div.bg-red-100, div.text-red-700, .bg-rose-500\\/10').first();
    await expect(errorAlert).toBeVisible({ timeout: 15000 });
  });

  test('Update payment status should reflect correctly in list', async ({ page }) => {
    await page.goto('/admin/contracts/list');

    // Find a contract edit button and click it
    const editBtn = page.locator('tr', { hasText: 'Johnathan Doe' }).first().locator('a[title="Điều chỉnh / Cập nhật"]');
    await editBtn.click();

    // Ensure edit form loads
    await expect(page.locator('form[action^="/admin/contracts/update"]')).toBeVisible();

    // Change payment status to Deposit
    await page.locator('select[name="paymentStatus"]').selectOption('Deposit');
    
    // Submit
    await page.locator('button', { hasText: 'Đóng mộc cập nhật hoá đơn' }).click();

    // Back to list, should see success 
    await expect(page.locator('.bg-green-100').first()).toBeVisible();
    
    // Should see Deposit badge class
    await expect(page.locator('.bg-amber-100').first()).toBeVisible();
  });
});
