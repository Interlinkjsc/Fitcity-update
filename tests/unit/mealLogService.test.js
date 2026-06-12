const mongoose = require('mongoose');
const MealLog = require('../../src/modules/programs/models/mealLogModel');
const mealLogService = require('../../src/modules/programs/services/mealLogService');

describe('mealLogService', () => {
    const clientId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await MealLog.deleteMany({ client: clientId });
    });

    it('logMeal upserts by mealType for same day', async () => {
        await mealLogService.logMeal({
            clientId,
            mealType: 'Breakfast',
            description: 'Phở',
            calories: 400
        });
        await mealLogService.logMeal({
            clientId,
            mealType: 'Breakfast',
            description: 'Bún',
            calories: 350
        });
        const logs = await mealLogService.getLogsForDate(clientId);
        expect(logs.length).toBe(1);
        expect(logs[0].description).toBe('Bún');
    });
});
