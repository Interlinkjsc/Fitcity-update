const mongoose = require('mongoose');
require('../../src/modules/users/models/userModel');
const WorkoutProgram = require('../../src/modules/programs/models/workoutProgramModel');
const ClientWorkoutAssignment = require('../../src/modules/programs/models/clientWorkoutAssignmentModel');
const workoutAssignmentService = require('../../src/modules/programs/services/workoutAssignmentService');

describe('workoutAssignmentService', () => {
    const clientId = new mongoose.Types.ObjectId();
    const ptId = new mongoose.Types.ObjectId();
    let programId;

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
        const program = await WorkoutProgram.create({
            title: 'Test Program',
            goal: 'Giảm cân',
            level: 'Beginner',
            sessionsPerWeek: 3,
            exercises: [
                { name: 'Squat', sets: '3', reps: '12' },
                { name: 'Push', sets: '3', reps: '10' }
            ]
        });
        programId = program._id;
    });

    afterAll(async () => {
        await WorkoutProgram.deleteMany({ title: 'Test Program' });
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await ClientWorkoutAssignment.deleteMany({ client: clientId });
    });

    it('assignProgramToClient creates week schedule', async () => {
        const a = await workoutAssignmentService.assignProgramToClient({
            clientId,
            ptId,
            programId
        });
        expect(a.weekSchedule.length).toBeGreaterThan(0);
        const active = await workoutAssignmentService.getActiveAssignment(clientId);
        expect(active.program.title).toBe('Test Program');
    });
});
