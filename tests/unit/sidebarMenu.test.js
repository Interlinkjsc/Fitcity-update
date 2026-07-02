/**
 * Unit Tests for Sidebar Menu Configuration
 */
const sidebarMenu = require('../../src/utils/sidebarMenu');

describe('sidebarMenu', () => {
    const ALL_ROLES = ['Admin', 'Manager', 'SA', 'CEO', 'Accountant', 'Sales', 'Marketing', 'PT', 'Client'];
    const MENU_COUNT = sidebarMenu.MENU_ITEMS.length;

    describe('MENU_ITEMS', () => {
        it('Should have expected menu items (aligned with 12-sa-standalone modules)', () => {
            expect(MENU_COUNT).toBe(30);
        });

        it('Each item should have key, label, href, moduleId, icon, and roles', () => {
            sidebarMenu.MENU_ITEMS.forEach((item) => {
                expect(item).toHaveProperty('key');
                expect(item).toHaveProperty('label');
                expect(item).toHaveProperty('href');
                expect(item).toHaveProperty('moduleId');
                expect(item).toHaveProperty('icon');
                expect(item).toHaveProperty('roles');
                expect(Array.isArray(item.roles)).toBe(true);
                expect(item.roles.length).toBeGreaterThan(0);
            });
        });

        it('Each item should have a unique key', () => {
            const keys = sidebarMenu.MENU_ITEMS.map((item) => item.key);
            expect(new Set(keys).size).toBe(keys.length);
        });

        it('Should include rewards, platform items, and export links', () => {
            const keys = sidebarMenu.MENU_ITEMS.map((i) => i.key);
            expect(keys).toContain('rewards');
            expect(keys).toContain('cms');
            expect(keys).toContain('settings');
            expect(keys).toContain('export-report');
            expect(keys).toContain('export-work-report');
        });

        it('SA should have SA in roles for cms, content_library, users, clients', () => {
            const byKey = Object.fromEntries(sidebarMenu.MENU_ITEMS.map((i) => [i.key, i]));
            expect(byKey.cms.roles).toContain('SA');
            expect(byKey.content_library.roles).toContain('SA');
            expect(byKey.users.roles).toContain('SA');
            expect(byKey.clients.roles).toContain('SA');
        });

        it('SA should see all items via getAllowedMenuItems', () => {
            const items = sidebarMenu.getAllowedMenuItems('SA');
            expect(items).toHaveLength(MENU_COUNT);
            expect(items).toBe(sidebarMenu.MENU_ITEMS);
        });
    });

    describe('getAllowedMenuGroups', () => {
        it('Should group items by moduleId', () => {
            const groups = sidebarMenu.getAllowedMenuGroups('SA');
            expect(groups.length).toBeGreaterThan(1);
            const moduleIds = groups.map((g) => g.moduleId);
            expect(moduleIds).toContain('dashboard');
            expect(moduleIds).toContain('platform');
            expect(moduleIds).toContain('programs');
        });

        it('Collapsible modules should have moduleIcon (Phase 2)', () => {
            const platform = sidebarMenu.getAllowedMenuGroups('SA').find((g) => g.moduleId === 'platform');
            expect(platform.collapsible).toBe(true);
            expect(platform.moduleIcon).toBeTruthy();
            const dashboard = sidebarMenu.getAllowedMenuGroups('SA').find((g) => g.moduleId === 'dashboard');
            expect(dashboard.collapsible).toBe(false);
        });

        it('Group item counts should match flat menu count', () => {
            const flat = sidebarMenu.getAllowedMenuItems('Admin');
            const groups = sidebarMenu.getAllowedMenuGroups('Admin');
            const total = groups.reduce((n, g) => n + g.items.length, 0);
            expect(total).toBe(flat.length);
        });
    });

    describe('getSidebarNavPayload', () => {
        it('Should return JSON-safe nav structure', () => {
            const payload = sidebarMenu.getSidebarNavPayload('SA', 'leads');
            expect(payload.activePage).toBe('leads');
            expect(payload.groups.some((g) => g.moduleId === 'crm')).toBe(true);
            expect(payload.groups[0].items[0]).toHaveProperty('href');
        });
    });

    describe('getAllowedMenuItems', () => {
        it('Marketing should see leads and content_library (CMS chỉ dành cho admin — 2/7/2026)', () => {
            const keys = sidebarMenu.getAllowedMenuItems('Marketing').map((m) => m.key);
            expect(keys).toContain('dashboard');
            expect(keys).toContain('leads');
            expect(keys).not.toContain('cms');
            expect(keys).toContain('content_library');
        });

        it('Sales should see dashboard, contracts, coupons', () => {
            const keys = sidebarMenu.getAllowedMenuItems('Sales').map((m) => m.key);
            expect(keys).toContain('dashboard');
            expect(keys).toContain('contracts');
            expect(keys).toContain('coupons');
            expect(keys).not.toContain('users');
        });

        it('PT should only see contracts', () => {
            const keys = sidebarMenu.getAllowedMenuItems('PT').map((m) => m.key);
            expect(keys).toEqual(['contracts']);
        });

        it('Should return empty array for null role', () => {
            expect(sidebarMenu.getAllowedMenuItems(null)).toEqual([]);
        });
    });

    describe('getAllowedPageKeys', () => {
        it('Should be consistent with getAllowedMenuItems', () => {
            ALL_ROLES.forEach((role) => {
                const items = sidebarMenu.getAllowedMenuItems(role);
                const keys = sidebarMenu.getAllowedPageKeys(role);
                expect(keys.size).toBe(items.length);
                items.forEach((item) => expect(keys.has(item.key)).toBe(true));
            });
        });
    });
});
