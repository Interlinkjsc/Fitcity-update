const mongoose = require('mongoose');
const PauseRequest = require('../../src/modules/contracts/models/pauseRequestModel.js');

describe('Pause Request Unit Tests', () => {
    beforeAll(async () => {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        await mongoose.connect(MONGODB_URI);
    });

    afterAll(async () => {
        await PauseRequest.deleteMany();
        await mongoose.connection.close();
    });

    it('Should create a valid pause request', async () => {
        const clientId = new mongoose.Types.ObjectId();
        const contractId = new mongoose.Types.ObjectId();
        
        const req = await PauseRequest.create({
            client: clientId,
            contract: contractId,
            startDate: new Date(),
            durationDays: 14,
            reason: 'Tripping abroad'
        });

        expect(req.status).toBe('Pending');
        expect(req.durationDays).toBe(14);
    });

    it('Should fail if duration is too short (< 7 days)', async () => {
        const req = new PauseRequest({
            client: new mongoose.Types.ObjectId(),
            contract: new mongoose.Types.ObjectId(),
            startDate: new Date(),
            durationDays: 5,
            reason: 'Short rest'
        });

        const err = req.validateSync();
        expect(err.errors.durationDays).toBeDefined();
    });
});
