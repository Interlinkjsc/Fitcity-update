const systemSettingsService = require('../../src/modules/platform/services/systemSettingsService.js');
const SystemSettings = require('../../src/modules/platform/models/systemSettingsModel.js');

describe('systemSettingsService', () => {
    beforeAll(async () => {
        const mongoose = require('mongoose');
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(uri);
        }
    });

    afterAll(async () => {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await SystemSettings.deleteMany({});
    });

    it('creates global settings with defaults when missing', async () => {
        const s = await systemSettingsService.getGlobalSettings();
        expect(s.defaultVat).toBe(10);
        expect(s.defaultPtCommissionRate).toBe(10);
    });

    it('updates VAT and PT commission rate', async () => {
        const updated = await systemSettingsService.updateGlobalSettings({
            defaultVat: 8,
            defaultPtCommissionRate: 12
        });
        expect(updated.defaultVat).toBe(8);
        expect(updated.defaultPtCommissionRate).toBe(12);
    });

    it('updates payroll mode and timesheet rate', async () => {
        const updated = await systemSettingsService.updateGlobalSettings({
            ptPayrollMode: 'hybrid',
            timesheetRatePerShift: 150000
        });
        expect(updated.ptPayrollMode).toBe('hybrid');
        expect(updated.timesheetRatePerShift).toBe(150000);
    });
});
