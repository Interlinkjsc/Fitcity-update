jest.mock('../../src/modules/platform/models/rolePermissionModel', () => ({
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn()
}));

const RolePermission = require('../../src/modules/platform/models/rolePermissionModel');
const permissionService = require('../../src/core/permissionService');

describe('permissionService', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        RolePermission.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
        await permissionService.refreshCache();
    });

    it('SA always has permission', async () => {
        expect(await permissionService.roleHasPermission('SA', 'payroll', 'view')).toBe(true);
    });

    it('Manager has suggested contract.view by default', async () => {
        expect(permissionService.roleHasPermissionSync('Manager', 'contract', 'view')).toBe(true);
    });

    it('Marketing denied payroll by default', async () => {
        expect(permissionService.roleHasPermissionSync('Marketing', 'payroll', 'view')).toBe(false);
    });

    it('getRolePermissionSummary returns grouped permissions for Manager', async () => {
        const summary = await permissionService.getRolePermissionSummary('Manager');
        expect(summary.role).toBe('Manager');
        expect(summary.count).toBeGreaterThan(0);
        expect(summary.grouped).toBeDefined();
    });

    it('assertCanAssignRole blocks Manager from creating Admin', () => {
        expect(() => permissionService.assertCanAssignRole('Manager', 'Admin')).toThrow();
    });

    it('saveRolePermissions updates cache', async () => {
        RolePermission.findOneAndUpdate.mockResolvedValue({});
        RolePermission.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                { role: 'Marketing', permissionIds: ['payroll.view'], isCustom: true }
            ])
        });
        await permissionService.saveRolePermissions('Marketing', ['payroll.view'], 'user1');
        expect(permissionService.roleHasPermissionSync('Marketing', 'payroll', 'view')).toBe(true);
    });

    it('getEffectivePermissionIds uses custom set when enabled', async () => {
        const ids = await permissionService.getEffectivePermissionIds({
            role: 'PT',
            useCustomPermissions: true,
            customPermissionIds: ['contract.view']
        });
        expect(ids).toEqual(['contract.view']);
    });

    it('userHasPermissionSync respects custom permissions', () => {
        const user = {
            role: 'Marketing',
            useCustomPermissions: true,
            customPermissionIds: ['payroll.view']
        };
        expect(permissionService.userHasPermissionSync(user, 'payroll', 'view')).toBe(true);
        expect(permissionService.userHasPermissionSync(user, 'contract', 'view')).toBe(false);
    });

    it('parsePermissionFieldsFromBody requires at least one permission', () => {
        const fields = permissionService.parsePermissionFieldsFromBody({
            useCustomPermissions: 'on',
            customPermissionIds: []
        });
        expect(fields.useCustomPermissions).toBe(false);
        expect(fields.customPermissionIds).toEqual([]);
    });

    it('assertCanGrantPermissions blocks PT from granting payroll', async () => {
        await expect(
            permissionService.assertCanGrantPermissions(
                { role: 'PT', useCustomPermissions: false },
                ['payroll.view']
            )
        ).rejects.toThrow(/không thể cấp quyền/);
    });
});
