const { test, expect } = require('@playwright/test');

test.describe('Leads Management Admin Flow', () => {

    test.beforeEach(async ({ page, isMobile }) => {
        if (isMobile) test.skip(); // Admin UI not optimized for mobile tests yet

        // Login as SA
        await page.goto('http://localhost:4000/auth/login');
        await page.fill('input[name="email"]', 'admin@fitcity.com');
        await page.fill('input[name="password"]', '123456');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('http://localhost:4000/admin');
        
        // Navigate to Leads
        await page.click('a[href="/admin/leads"]');
        await expect(page).toHaveURL('http://localhost:4000/admin/leads');
    });

    test('should display all 3 seeded leads and search by name', async ({ page }) => {
        // Seed creates exactly 3 leads: Hoàng Minh (Gym/F), Lê Thu Thảo (Yoga/Contacted), Trần Văn Hùng (PT/Signed)
        await expect(page.locator('.lead-row')).toHaveCount(3);

        // Verify stat cards
        await expect(page.locator('h3:has-text("33.3%")')).toBeVisible(); // PT ratio = 1/3

        // Client-side search for 'Hoàng Minh'
        const searchInput = page.locator('#search-leads');
        await searchInput.fill('Hoàng Minh');
        
        // Only rows containing 'Hoàng Minh' should be visible
        const visibleRows = page.locator('.lead-row:visible');
        await expect(visibleRows).toHaveCount(1);
        await expect(visibleRows).toContainText('Hoàng Minh');
        
        // Clear search → all 3 should return
        await searchInput.fill('');
        await expect(page.locator('.lead-row:visible')).toHaveCount(3);
    });

    test('should toggle filter panel and apply server-side filtering', async ({ page }) => {
        const filterPanel = page.locator('#filter-panel');
        const toggleBtn = page.locator('#btn-toggle-filter');

        // Initial: Filter panel should be hidden (no filter params in URL)
        await expect(filterPanel).toBeHidden();

        // Toggle → Open
        await toggleBtn.click();
        await expect(filterPanel).toBeVisible();

        // Toggle → Close
        await toggleBtn.click();
        await expect(filterPanel).toBeHidden();

        // Toggle → Open again for filtering
        await toggleBtn.click();
        await expect(filterPanel).toBeVisible();

        // Filter by Status: 'F' (Khách F)
        await page.selectOption('select[name="status"]', 'F');
        await page.click('#filter-panel button[type="submit"]');

        // Verify URL contains status=F
        await expect(page).toHaveURL(/status=F/);
        
        // Only 1 lead with status 'Khách F' should appear
        await expect(page.locator('.lead-row')).toHaveCount(1);
        await expect(page.locator('.lead-row')).toContainText('Hoàng Minh');

        // Filter panel should remain visible (because filter is active)
        await expect(filterPanel).toBeVisible();
    });

    test('should filter by interested package', async ({ page }) => {
        // Go with query param directly
        await page.goto('http://localhost:4000/admin/leads?interestedPackage=Yoga');

        // Should show only Yoga leads = Lê Thu Thảo
        await expect(page.locator('.lead-row')).toHaveCount(1);
        await expect(page.locator('.lead-row')).toContainText('Lê Thu Thảo');
        await expect(page.locator('.lead-row')).toContainText('Yoga');
        
        // Filter panel should be visible (filter is active)
        await expect(page.locator('#filter-panel')).toBeVisible();
        
        // 'Yoga' should be selected in the dropdown
        const pkgSelect = page.locator('select[name="interestedPackage"]');
        await expect(pkgSelect).toHaveValue('Yoga');
    });

    test('should clear filters and return to full list', async ({ page }) => {
        // Go to a filtered view
        await page.goto('http://localhost:4000/admin/leads?status=Signed&interestedPackage=PT');
        await expect(page.locator('.lead-row')).toHaveCount(1);
        await expect(page.locator('.lead-row')).toContainText('Trần Văn Hùng');
        
        // Click "Xoá bộ lọc"
        await page.click('a:has-text("Xoá bộ lọc")');
        
        // Should be back to base URL with all 3 leads
        await expect(page).toHaveURL('http://localhost:4000/admin/leads');
        await expect(page.locator('.lead-row')).toHaveCount(3);
    });

    test('should have correct Excel export link with current filter params', async ({ page }) => {
        // Without filter
        const exportBtn = page.locator('#btn-export-excel');
        const href1 = await exportBtn.getAttribute('href');
        expect(href1).toContain('/admin/leads/export');
        expect(href1).toContain('status=all');
        
        // With filter
        await page.goto('http://localhost:4000/admin/leads?status=Contacted&source=Website');
        const href2 = await page.locator('#btn-export-excel').getAttribute('href');
        expect(href2).toContain('status=Contacted');
        expect(href2).toContain('source=Website');
    });

});
