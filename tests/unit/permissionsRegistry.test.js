const registry = require('../../src/core/permissionsRegistry');

describe('permissionsRegistry', () => {
    it('lists all permissions with unique ids', () => {
        const ids = registry.PERMISSIONS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('suggests contract.view for Manager and Sales', () => {
        expect(registry.getSuggestedPermissionIds('Manager')).toContain('contract.view');
        expect(registry.getSuggestedPermissionIds('Sales')).toContain('contract.view');
    });

    it('does not suggest payroll to Marketing', () => {
        expect(registry.getSuggestedPermissionIds('Marketing')).not.toContain('payroll.view');
    });

    it('builds matrix from role permission map', () => {
        const map = { Manager: ['contract.view', 'staff_management.view'] };
        const matrix = registry.buildMatrixFromRolePermissions(map);
        expect(matrix.contract.view).toContain('Manager');
        expect(matrix.staff_management.view).toContain('Manager');
    });
});
