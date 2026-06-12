const mongoose = require('mongoose');
const qualityService = require('../../src/modules/platform/services/qualityService.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const User = require('../../src/modules/users/models/userModel.js');

describe('qualityService.getCsatSummary', () => {
    let clientId;
    let ptId;

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
        await WorkoutSession.deleteMany({});
        const client = await User.create({
            name: 'CSAT Client',
            email: `csat_${Date.now()}@test.com`,
            emailHash: `h_${Date.now()}`,
            password: 'pass123',
            role: 'Client'
        });
        const pt = await User.create({
            name: 'CSAT PT',
            email: `ptcsat_${Date.now()}@test.com`,
            emailHash: `hp_${Date.now()}`,
            password: 'pass123',
            role: 'PT'
        });
        clientId = client._id;
        ptId = pt._id;
    });

    it('returns zero stats when no completed sessions', async () => {
        const summary = await qualityService.getCsatSummary({});
        expect(summary.totalCompleted).toBe(0);
        expect(summary.avgRating).toBe(0);
    });

    it('computes average rating and feedback rate', async () => {
        await WorkoutSession.create({
            client: clientId,
            pt: ptId,
            contract: new mongoose.Types.ObjectId(),
            branch: new mongoose.Types.ObjectId(),
            scheduledTime: new Date(),
            endTime: new Date(),
            status: 'Completed',
            feedback: { rating: 5, comment: 'Great' }
        });
        await WorkoutSession.create({
            client: clientId,
            pt: ptId,
            contract: new mongoose.Types.ObjectId(),
            branch: new mongoose.Types.ObjectId(),
            scheduledTime: new Date(),
            endTime: new Date(),
            status: 'Completed'
        });

        const summary = await qualityService.getCsatSummary({});
        expect(summary.totalCompleted).toBe(2);
        expect(summary.ratedSessions).toBe(1);
        expect(summary.feedbackRatePercent).toBe(50);
        expect(summary.avgRating).toBe(5);
    });
});
