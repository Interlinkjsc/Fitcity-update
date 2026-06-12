const { test, expect } = require('@playwright/test');

const creds = {
    pt: { email: 'e2e.pt@fitcity.com', password: '123456' },
    client: { email: 'e2e.client@fitcity.com', password: '123456' }
};

async function login(page, email, password, expectedPath) {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp(expectedPath));
}

async function extractQrToken(page) {
    const input = page.locator('#qrTokenValue');
    await expect(input).toHaveCount(1);
    const token = await input.inputValue();
    if (!token) throw new Error('Không trích xuất được QR token.');
    return token;
}

test.describe('Client/PT large dataset E2E (>30 records)', () => {
    test('sanity: large data renders in workouts/progress/schedule', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await login(page, creds.client.email, creds.client.password, '/client');

        await page.goto('/client/workouts');
        await expect(page.getByRole('heading', { name: /BÀI TẬP/i }).first()).toBeVisible();

        await page.goto('/client/progress');
        const totalText = await page.locator('span').filter({ hasText: /^Total \d+ Records$/ }).first().textContent();
        const match = totalText && totalText.match(/Total (\d+) Records/);
        expect(match).toBeTruthy();
        expect(Number(match[1])).toBeGreaterThanOrEqual(30);

        await page.goto('/client/schedule');
        await expect(page.getByText('Yêu cầu gần đây')).toBeVisible();
        await expect(page.getByText('Slot PT mở sẵn trong tuần')).toBeVisible();

        await context.close();
    });

    test('qr-only flow: client shows QR start/end and PT scans', async ({ browser }) => {
        const clientContext = await browser.newContext();
        const ptContext = await browser.newContext();
        const clientPage = await clientContext.newPage();
        const ptPage = await ptContext.newPage();

        await login(clientPage, creds.client.email, creds.client.password, '/client');
        await login(ptPage, creds.pt.email, creds.pt.password, '/pt');

        await clientPage.goto('/client/workouts');
        const startBtn = clientPage.getByRole('link', { name: /HIỂN THỊ QR BẮT ĐẦU/i }).first();
        await expect(startBtn).toBeVisible();
        await startBtn.click();
        await clientPage.waitForURL(/\/client\/sessions\/.*\/qr\?action=start/);
        const startToken = await extractQrToken(clientPage);

        await ptPage.goto('/pt/scan');
        await ptPage.fill('textarea[name="token"]', startToken);
        await ptPage.click('button[type="submit"]');
        await ptPage.waitForURL(/\/pt$/);

        await clientPage.goto('/client/workouts');
        const endBtn = clientPage.getByRole('link', { name: /HIỂN THỊ QR KẾT THÚC/i }).first();
        await expect(endBtn).toBeVisible();
        await endBtn.click();
        await clientPage.waitForURL(/\/client\/sessions\/.*\/qr\?action=end/);
        const endToken = await extractQrToken(clientPage);

        await ptPage.goto('/pt/scan');
        await ptPage.fill('textarea[name="token"]', endToken);
        await ptPage.click('button[type="submit"]');
        await ptPage.waitForURL(/\/pt$/);

        await clientPage.goto('/client');
        await expect(clientPage.getByRole('button', { name: /XÁC NHẬN ĐÃ TẬP XONG/i }).first()).toBeVisible();

        await clientContext.close();
        await ptContext.close();
    });

    test('schedule/request interaction: client request and PT approve', async ({ browser }) => {
        const clientContext = await browser.newContext();
        const ptContext = await browser.newContext();
        const clientPage = await clientContext.newPage();
        const ptPage = await ptContext.newPage();

        await login(clientPage, creds.client.email, creds.client.password, '/client');
        await login(ptPage, creds.pt.email, creds.pt.password, '/pt');

        await clientPage.goto('/client/schedule');
        const requestBtn = clientPage.getByRole('button', { name: 'Yêu cầu đặt' }).first();
        await expect(requestBtn).toBeVisible();
        await requestBtn.click();
        await clientPage.waitForURL(/\/client\/schedule/);

        await ptPage.goto('/pt/requests');
        const approveBtn = ptPage.getByRole('button', { name: 'Duyệt' }).first();
        await expect(approveBtn).toBeVisible();
        await approveBtn.click();
        await ptPage.waitForURL(/\/pt\/requests/);

        await clientPage.goto('/client/schedule');
        await expect(clientPage.getByText(/Đã duyệt \/ Đã đặt|Đang chờ PT duyệt/).first()).toBeVisible();

        await clientContext.close();
        await ptContext.close();
    });
});

