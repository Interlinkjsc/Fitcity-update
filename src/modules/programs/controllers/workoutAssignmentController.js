const WorkoutProgram = require('../models/workoutProgramModel');
const workoutAssignmentService = require('../services/workoutAssignmentService');

exports.getAssignPage = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const [clients, programs] = await Promise.all([
            workoutAssignmentService.getPtClientsForAssignment(ptId),
            WorkoutProgram.find({ $or: [{ isPublic: true }, { createdBy: ptId }] }).sort({ title: 1 })
        ]);
        res.render('pt/workout-assignments/index', {
            clients,
            programs,
            activePage: 'workout-assignments'
        });
    } catch (err) {
        next(err);
    }
};

exports.storeAssignment = async (req, res, next) => {
    try {
        const { clientId, programId } = req.body;
        if (!clientId || !programId) {
            req.flash('error_msg', 'Chọn khách hàng và giáo trình.');
            return res.redirect('/pt/workout-assignments');
        }
        await workoutAssignmentService.assignProgramToClient({
            clientId,
            ptId: req.session.user.id,
            programId
        });
        req.flash('success_msg', 'Đã gán lộ trình tuần cho hội viên.');
        res.redirect('/pt/workout-assignments');
    } catch (err) {
        next(err);
    }
};
