const ClientWorkoutAssignment = require('../models/clientWorkoutAssignmentModel');
const WorkoutProgram = require('../models/workoutProgramModel');

function buildDefaultWeekSchedule(program) {
    const exercises = program.exercises || [];
    const daysPerWeek = Math.min(program.sessionsPerWeek || 3, 7);
    const schedule = [];
    for (let i = 0; i < daysPerWeek; i++) {
        const chunk = [];
        const perDay = Math.ceil(exercises.length / daysPerWeek) || 1;
        for (let j = 0; j < perDay; j++) {
            const ex = exercises[(i * perDay + j) % exercises.length];
            if (ex) chunk.push(ex);
        }
        schedule.push({
            dayOfWeek: i + 1,
            sessionTitle: `Buổi ${i + 1} — ${program.title}`,
            exercises: chunk
        });
    }
    return schedule;
}

exports.assignProgramToClient = async ({ clientId, ptId, programId, weekSchedule }) => {
    const program = await WorkoutProgram.findById(programId);
    if (!program) throw new Error('Không tìm thấy giáo trình');

    await ClientWorkoutAssignment.updateMany({ client: clientId, active: true }, { active: false });

    const assignment = await ClientWorkoutAssignment.create({
        client: clientId,
        pt: ptId,
        program: programId,
        startDate: new Date(),
        weekSchedule: weekSchedule && weekSchedule.length ? weekSchedule : buildDefaultWeekSchedule(program),
        active: true
    });

    return assignment.populate('program');
};

exports.getActiveAssignment = async (clientId) =>
    ClientWorkoutAssignment.findOne({ client: clientId, active: true })
        .populate('program')
        .populate('pt', 'name avatar');

exports.getPtClientsForAssignment = async (ptId) => {
    const Contract = require('../../contracts/models/contractModel');
    const contracts = await Contract.find({ pt: ptId, $or: [{ contractStatus: 'Active' }, { contractStatus: 'Draft', paymentStatus: 'Deposit' }] }).populate(
        'client',
        'name email avatar'
    );
    const seen = new Set();
    const clients = [];
    for (const c of contracts) {
        if (c.client && !seen.has(c.client._id.toString())) {
            clients.push(c.client);
            seen.add(c.client._id.toString());
        }
    }
    return clients;
};
