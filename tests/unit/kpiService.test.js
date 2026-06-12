const { resolveEmployeeTargets } = require('../../src/modules/platform/services/kpiService');

describe('kpiService.resolveEmployeeTargets', () => {
    const branchConfig = {
        revenueTarget: 100_000_000,
        contractTarget: 10,
        newLeadTarget: 50
    };

    it('prefers employee targets when record exists', () => {
        const employee = {
            revenueTarget: 80_000_000,
            contractTarget: 8,
            newLeadTarget: 40,
            sessionTarget: 60
        };
        const result = resolveEmployeeTargets(employee, branchConfig);
        expect(result).toEqual({
            revenueTarget: 80_000_000,
            contractTarget: 8,
            newLeadTarget: 40,
            sessionTarget: 60,
            targetSource: 'employee'
        });
    });

    it('falls back to branch config when no employee record', () => {
        const result = resolveEmployeeTargets(null, branchConfig);
        expect(result).toEqual({
            revenueTarget: 100_000_000,
            contractTarget: 10,
            newLeadTarget: 50,
            sessionTarget: 0,
            targetSource: 'branch'
        });
    });

    it('returns none when neither employee nor branch targets exist', () => {
        const result = resolveEmployeeTargets(null, null);
        expect(result.targetSource).toBe('none');
        expect(result.revenueTarget).toBe(0);
    });
});
