const mongoose = require('mongoose');
const timesheetService = require('../../src/modules/pt/services/timesheetService.js');
const Timesheet = require('../../src/modules/pt/models/timesheetModel.js');

describe('timesheetService', () => {
    const staffId = new mongoose.Types.ObjectId();
    const branchId = new mongoose.Types.ObjectId();
    const managerId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(uri);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await Timesheet.deleteMany({});
    });

    it('checkIn creates open entry', async () => {
        const entry = await timesheetService.checkIn(staffId, branchId);
        expect(entry.status).toBe('Open');
        expect(entry.staff.toString()).toBe(staffId.toString());
    });

    it('checkOut moves entry to Pending_Approval', async () => {
        await timesheetService.checkIn(staffId, branchId);
        const out = await timesheetService.checkOut(staffId);
        expect(out.status).toBe('Pending_Approval');
        expect(out.checkOut).toBeTruthy();
    });

    it('approve counts toward approved shifts', async () => {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const entry = await Timesheet.create({
            staff: staffId,
            branch: branchId,
            checkIn: new Date(year, month - 1, 5, 8),
            checkOut: new Date(year, month - 1, 5, 10),
            status: 'Pending_Approval'
        });
        await timesheetService.approve(entry._id, managerId);
        const count = await timesheetService.countApprovedShifts(staffId, month, year);
        expect(count).toBe(1);
    });

    it('blocks double check-in while open', async () => {
        await timesheetService.checkIn(staffId, branchId);
        await expect(timesheetService.checkIn(staffId, branchId)).rejects.toThrow(/check-out/);
    });
});
