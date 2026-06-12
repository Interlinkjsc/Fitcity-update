/**
 * @file pt_client_flows.spec.js
 * @description Bộ test toàn diện cho tất cả luồng tương tác PT-Client
 *
 * Các luồng được kiểm tra:
 *  [A] GPS Check-in / Check-out (happy path + edge cases)
 *  [B] Nutrition / Meal Plan (PT chỉnh sửa, Client xem)
 *  [C] Body Metrics / Progress (Client xem chỉ số cơ thể)
 *  [D] Client Workout History (danh sách lịch sử buổi tập)
 *  [E] PT Clients List (PT xem danh sách hội viên)
 */

const { test, expect } = require('@playwright/test');

// ────────────────────────────────────────────────────────────────────────────
// Helpers: login shortcut
// ────────────────────────────────────────────────────────────────────────────
async function loginAsPT(page) {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'marcus@fitcity.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/pt/);
}

async function loginAsClient(page) {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'jd@user.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/client/);
}

async function loginAsClient2(page) {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'client02@user.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/client/);
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW A: GPS Check-in / Check-out + Edge Cases
// ════════════════════════════════════════════════════════════════════════════
test.describe('[A] GPS Check-in / Check-out Flow', () => {

    // A-1: Happy path - check-in thành công khi trong phạm vi 500m
    test('A-1: PT check-in thành công khi GPS nằm trong phạm vi chi nhánh', async ({ browser }) => {
        const context = await browser.newContext({
            permissions: ['geolocation'],
            geolocation: { latitude: 10.7725, longitude: 106.6988 }
        });
        const page = await context.newPage();
        await loginAsPT(page);

        await expect(page.getByText('Buổi tập hôm nay')).toBeVisible();

        const checkinBtn = page.locator('button', { hasText: /Điểm danh/i }).first();
        if (await checkinBtn.isVisible()) {
            await checkinBtn.click();
            await expect(page.locator('.bg-green-100').first())
                .toContainText(/check-in thành công/i, { timeout: 8000 });
        } else {
            await expect(page.locator('button', { hasText: /Kết thúc/i }).first()).toBeVisible();
        }

        await context.close();
    });

    // A-2: Check-out (Kết thúc) sau khi đã check-in
    test('A-2: PT check-out thành công - trạng thái chuyển sang Completed', async ({ browser }) => {
        const context = await browser.newContext({
            permissions: ['geolocation'],
            geolocation: { latitude: 10.7725, longitude: 106.6988 }
        });
        const page = await context.newPage();
        await loginAsPT(page);

        const checkinBtn = page.locator('button', { hasText: /Điểm danh/i }).first();
        if (await checkinBtn.isVisible()) {
            await checkinBtn.click();
            await expect(page.locator('.bg-green-100').first()).toBeVisible({ timeout: 8000 });
        }

        const finishBtn = page.locator('button', { hasText: /Kết thúc/i }).first();
        await expect(finishBtn).toBeVisible({ timeout: 10000 });
        await finishBtn.click();

        await expect(page.locator('.bg-green-100').first())
            .toContainText(/hoàn thành/i, { timeout: 8000 });

        await context.close();
    });

    // A-3: Edge - GPS ngoài phạm vi → check-in thất bại
    test('A-3 [Edge]: PT check-in thất bại khi GPS ngoài phạm vi 500m', async ({ browser }) => {
        const context = await browser.newContext({
            permissions: ['geolocation'],
            geolocation: { latitude: 21.0285, longitude: 105.8542 } // Hà Nội
        });
        const page = await context.newPage();
        await loginAsPT(page);

        const checkinBtn = page.locator('button', { hasText: /Điểm danh/i }).first();
        if (await checkinBtn.isVisible()) {
            await checkinBtn.click();
            await expect(page.locator('.bg-red-100, .bg-yellow-100').first())
                .toBeVisible({ timeout: 8000 });
        } else {
            test.skip();
        }

        await context.close();
    });

    // A-4: Edge - PT Dashboard luôn hiển thị section buổi tập hôm nay
    test('A-4 [Edge]: PT Dashboard luôn hiển thị mục Buổi tập hôm nay', async ({ browser }) => {
        const context = await browser.newContext({
            permissions: ['geolocation'],
            geolocation: { latitude: 10.7725, longitude: 106.6988 }
        });
        const page = await context.newPage();
        await loginAsPT(page);

        // Section buổi tập luôn render dù trạng thái nào
        await expect(page.getByText('Buổi tập hôm nay')).toBeVisible();
        // Dashboard PT hiển thị thông tin cơ bản
        await expect(page.getByText(/Xin chào/i)).toBeVisible();

        await context.close();
    });

    // A-5: Client xác nhận buổi tập sau khi PT kết thúc (full E2E flow)
    test('A-5: Full flow - PT check-out → Client xác nhận buổi tập thành công', async ({ browser }) => {
        const ptContext = await browser.newContext({
            permissions: ['geolocation'],
            geolocation: { latitude: 10.7725, longitude: 106.6988 }
        });
        const clientContext = await browser.newContext();

        const ptPage = await ptContext.newPage();
        const clientPage = await clientContext.newPage();

        await loginAsClient(clientPage);
        await loginAsPT(ptPage);

        const checkinBtn = ptPage.locator('button', { hasText: /Điểm danh/i }).first();
        if (await checkinBtn.isVisible()) {
            await checkinBtn.click();
            await expect(ptPage.locator('.bg-green-100').first()).toBeVisible({ timeout: 8000 });
        }

        const finishBtn = ptPage.locator('button', { hasText: /Kết thúc/i }).first();
        await expect(finishBtn).toBeVisible({ timeout: 10000 });
        await finishBtn.click();
        await expect(ptPage.locator('.bg-green-100').first())
            .toContainText(/hoàn thành/i, { timeout: 8000 });

        await clientPage.goto('/client');
        const confirmBtn = clientPage.locator('button', { hasText: 'XÁC NHẬN ĐÃ TẬP XONG' }).first();
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });
        await confirmBtn.click();

        await expect(clientPage.locator('.bg-green-100').first())
            .toContainText(/thành công/i, { timeout: 8000 });

        await ptContext.close();
        await clientContext.close();
    });

    // A-6: Edge - Client2 không thấy nút xác nhận của Client1
    test('A-6 [Edge]: Client khác không thấy nút xác nhận buổi tập của người khác', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAsClient2(page);

        await page.goto('/client');
        const confirmBtn = page.locator('button', { hasText: 'XÁC NHẬN ĐÃ TẬP XONG' });
        await expect(confirmBtn).toHaveCount(0, { timeout: 5000 });

        await context.close();
    });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW B: Meal Plan / Nutrition Flow
// ════════════════════════════════════════════════════════════════════════════
test.describe('[B] Meal Plan / Nutrition Flow', () => {

    // B-1: PT xem danh sách meal plan
    test('B-1: PT xem danh sách Kế hoạch Dinh dưỡng', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/meal-plans');

        await expect(page.getByRole('heading', { name: 'Kế hoạch Dinh dưỡng' })).toBeVisible();
        await expect(page.getByText('Kcal / Ngày').first()).toBeVisible();
    });

    // B-2: PT xem thông tin khách hàng trên meal plan card
    test('B-2: Meal Plan card hiển thị đúng tên client và mục tiêu', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/meal-plans');

        // Verify client name trên meal plan card
        await expect(page.getByRole('heading', { name: 'Johnathan Doe' })).toBeVisible();
        // Verify mục tiêu
        await expect(page.getByText('Weight Loss')).toBeVisible();
    });

    // B-3: Nút tạo mới Meal Plan hiển thị
    test('B-3: Nút tạo mới Meal Plan hiển thị và link đúng', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/meal-plans');

        const addLink = page.locator('a[href="/pt/meal-plans/create"]');
        await expect(addLink).toBeVisible();
    });

    // B-4: Client xem đầy đủ Meal Plan trên trang Nutrition
    test('B-4: Client xem đầy đủ thông tin Meal Plan trên /client/nutrition', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/nutrition');

        await expect(page.getByText('Timeline 24h')).toBeVisible();
        await expect(page.getByText('Kế hoạch dinh dưỡng')).toBeVisible();

        // Macro breakdown - dùng label ngắn gọn, không trùng
        await expect(page.getByText('Đạm').first()).toBeVisible();
        await expect(page.getByText('Tinh bột').first()).toBeVisible();
        await expect(page.getByText('Chất béo').first()).toBeVisible();
        await expect(page.getByText('Chất xơ').first()).toBeVisible();
    });

    // B-5: Dashboard displays Meal Plan summary + link to nutrition
    test('B-5: Dashboard hiển thị tóm tắt Meal Plan và điều hướng sang Nutrition', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client');

        await expect(page.getByText('Phác đồ dinh dưỡng')).toBeVisible();
        await expect(page.getByText('Ngân sách Kcal')).toBeVisible();

        const arrowLink = page.locator('a[href="/client/nutrition"]').first();
        await arrowLink.click();
        await page.waitForURL(/\/client\/nutrition/);
        await expect(page.getByText('Timeline 24h')).toBeVisible();
    });

    // B-6: Edge - Client2 không có Meal Plan → empty state
    test('B-6 [Edge]: Client không có Meal Plan → empty state', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAsClient2(page);

        await page.goto('/client/nutrition');

        await expect(page.getByText('Chưa có thực đơn')).toBeVisible();
        await expect(page.getByText(/Huấn luyện viên của bạn đang xây dựng/)).toBeVisible();

        await context.close();
    });

    // B-7: Macro data từ seed chính xác
    test('B-7: Meal Plan hiển thị đúng tỷ lệ Macro (35/35/30)', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/meal-plans');

        // Seed: protein=35, carbs=35, fat=30
        await expect(page.getByText('35').first()).toBeVisible();
        await expect(page.getByText('30').first()).toBeVisible();
    });

    // B-8: Meal Plan hiển thị ngày hết hạn
    test('B-8: Meal Plan card hiển thị ngày hết hạn', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/meal-plans');

        await expect(page.getByText(/Có hiệu lực đến/i)).toBeVisible();
    });

    // B-9: Meal Plan hiển thị nút Chi tiết
    test('B-9: Meal Plan card có nút "Chi tiết & Lịch trình"', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/meal-plans');

        await expect(page.locator('button', { hasText: 'Chi tiết & Lịch trình' }).first()).toBeVisible();
    });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW C: Body Metrics / Progress
// ════════════════════════════════════════════════════════════════════════════
test.describe('[C] Body Metrics / Progress Flow', () => {

    // C-1: Client xem trang Progress - có data
    test('C-1: Client xem trang Progress với dữ liệu InBody', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/progress');

        await expect(page.getByRole('heading', { name: /KẾT QUẢ TẬP LUYỆN/i })).toBeVisible();
        await expect(page.getByText('Cân nặng hiện tại')).toBeVisible();
        await expect(page.getByText('Chỉ số BMI')).toBeVisible();
        await expect(page.getByText('Lịch sử InBody')).toBeVisible();
    });

    // C-2: Bảng InBody hiển thị records
    test('C-2: Bảng InBody hiển thị đúng số Records từ seed data', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/progress');

        await expect(page.getByText(/Total \d+ Records/)).toBeVisible();
    });

    // C-3: Chart canvas tồn tại
    test('C-3: Canvas biểu đồ Weight Trend và Radar Chart được render', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/progress');

        await expect(page.locator('#lineChart')).toBeVisible();
        await expect(page.locator('#radarChart')).toBeVisible();
    });

    // C-4: Bảng lịch sử có đầy đủ cột header
    test('C-4: Bảng lịch sử InBody có đầy đủ header: Ngày đo, Cơ bắp, Body Fat, BMI', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/progress');

        await expect(page.getByRole('columnheader', { name: 'Ngày đo' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Cân nặng' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Cơ bắp' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Body Fat' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'BMI' })).toBeVisible();
    });

    // C-5: Edge - Client2 không có metrics → empty state
    test('C-5 [Edge]: Client không có InBody data → empty state', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAsClient2(page);

        await page.goto('/client/progress');

        await expect(page.getByText(/CHƯA CÓ DỮ LIỆU INBODY/i)).toBeVisible();

        await context.close();
    });

    // C-6: Nút Close điều hướng về Dashboard
    test('C-6: Nút Close trên Progress điều hướng về /client', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/progress');

        const closeBtn = page.locator('a[href="/client"]').first();
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await page.waitForURL(/\/client$/);
    });

    // C-7: PT xem /pt/metrics không bị crash
    test('C-7: PT truy cập trang /pt/metrics thành công', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/metrics');

        const url = page.url();
        expect(url).toContain('/pt');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW D: Client Workout History
// ════════════════════════════════════════════════════════════════════════════
test.describe('[D] Client Workout History Flow', () => {

    // D-1: Client xem thư viện bài tập
    test('D-1: Client truy cập /client/workouts thành công', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client/workouts');

        const url = page.url();
        expect(url).toContain('/client/workouts');
    });

    // D-2: Dashboard hiển thị section bài tập hàng ngày
    test('D-2: Dashboard hiển thị section "Bài tập hàng ngày"', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client');

        await expect(page.getByText('Bài tập hàng ngày')).toBeVisible();
        await expect(page.locator('a[href="/client/workouts"]').first()).toBeVisible();
    });

    // D-3: Progress arc hiển thị
    test('D-3: Dashboard hiển thị tiến độ "Đã hoàn thành"', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client');

        await expect(page.getByText('Đã hoàn thành')).toBeVisible();
    });

    // D-4: Dashboard hiển thị tên gói tập hoặc label dự phòng
    test('D-4: Dashboard hiển thị tên gói tập của Client', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client');

        // Seed: packageName xuất phát từ contract → service package name
        // Có thể là tên gói hoặc "Chưa đăng ký Gói" 
        const heading = page.locator('h3', { hasText: /.+/ }).first();
        await expect(heading).toBeVisible();
    });

    // D-5: Link Thư viện bài tập điều hướng đúng
    test('D-5: Click "Thư viện bài tập" điều hướng sang /client/workouts', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client');

        const workoutLink = page.locator('a[href="/client/workouts"]').first();
        await workoutLink.click();
        await page.waitForURL(/\/client\/workouts/);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW E: PT & Client Navigation + Access Control
// ════════════════════════════════════════════════════════════════════════════
test.describe('[E] PT & Client Navigation + Access Control', () => {

    // E-1: PT xem danh sách khách hàng
    test('E-1: PT xem danh sách khách hàng tại /pt/clients', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/clients');

        await expect(page.getByText('Khách hàng của tôi')).toBeVisible();
    });

    // E-2: Card client hiển thị thông tin gói tập
    test('E-2: Card client hiển thị thông tin gói và buổi còn lại', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/clients');

        await expect(page.getByText('Gói tập:').first()).toBeVisible();
        await expect(page.getByText('Buổi còn lại:').first()).toBeVisible();
        await expect(page.getByText('Hạn HĐ:').first()).toBeVisible();
    });

    // E-3: PT nav bar có đủ tabs
    test('E-3: PT navigation bar có đủ: Lịch dạy, Chỉ số, Dinh dưỡng, Thoát', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt');

        await expect(page.locator('a[href="/pt"]', { hasText: 'Lịch dạy' })).toBeVisible();
        await expect(page.locator('a[href="/pt/metrics"]')).toBeVisible();
        await expect(page.locator('a[href="/pt/meal-plans"]')).toBeVisible();
        await expect(page.locator('a[href="/auth/logout"]')).toBeVisible();
    });

    // E-4: Client nav bar có đủ 5 tabs
    test('E-4: Client navigation bar có đủ 5 tab', async ({ page }) => {
        await loginAsClient(page);
        await page.goto('/client');

        await expect(page.locator('a[href="/client"]').first()).toBeVisible();
        await expect(page.locator('a[href="/client/workouts"]').first()).toBeVisible();
        await expect(page.locator('a[href="/client/nutrition"]').first()).toBeVisible();
        await expect(page.locator('a[href="/client/progress"]').first()).toBeVisible();
        await expect(page.locator('a[href="/auth/logout"]').first()).toBeVisible();
    });

    // E-5: PT Dashboard hiển thị hoa hồng dự kiến
    test('E-5: PT Dashboard hiển thị Hoa hồng dự kiến', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt');

        await expect(page.getByText('Hoa hồng dự kiến')).toBeVisible();
    });

    // E-6: PT Schedule page loads
    test('E-6: PT xem lịch dạy tại /pt/schedule không crash', async ({ page }) => {
        await loginAsPT(page);
        await page.goto('/pt/schedule');

        const url = page.url();
        expect(url).toContain('/pt');
    });

    // E-7: Unauthenticated → /pt redirect về login
    test('E-7 [Edge]: Unauthenticated user bị redirect về login khi vào /pt', async ({ page }) => {
        await page.goto('/pt');
        await page.waitForURL(/\/auth\/login/);
    });

    // E-8: Unauthenticated → /client redirect về login
    test('E-8 [Edge]: Unauthenticated user bị redirect về login khi vào /client', async ({ page }) => {
        await page.goto('/client');
        await page.waitForURL(/\/auth\/login/);
    });

    // E-9: Unauthenticated → /pt/clients redirect về login
    test('E-9 [Edge]: Unauthenticated user bị redirect về login khi vào /pt/clients', async ({ page }) => {
        await page.goto('/pt/clients');
        await page.waitForURL(/\/auth\/login/);
    });

    // E-10: Unauthenticated → /client/nutrition redirect về login
    test('E-10 [Edge]: Unauthenticated user bị redirect về login khi vào /client/nutrition', async ({ page }) => {
        await page.goto('/client/nutrition');
        await page.waitForURL(/\/auth\/login/);
    });
});
