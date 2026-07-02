const clientController = require('../../src/modules/clients/controllers/clientController.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const WorkoutProgram = require('../../src/modules/programs/models/workoutProgramModel.js');
const mongoose = require('mongoose');

// Mock WorkoutSession
jest.mock('../../src/modules/programs/models/workoutSessionModel.js');
jest.mock('../../src/modules/programs/models/workoutProgramModel.js');

describe('Client Controller', () => {
    describe('getWorkouts', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                session: {
                    user: {
                        id: new mongoose.Types.ObjectId().toString()
                    }
                }
            };
            res = {
                render: jest.fn()
            };
            next = jest.fn();
            
            // Setup mock chain
            WorkoutSession.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue([
                        { _id: 'session1', client: req.session.user.id }
                    ])
                })
            });
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should correctly fetch session data ONLY for the logged in user', async () => {
            WorkoutProgram.find.mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            });

            await clientController.getWorkouts(req, res, next);
            
            expect(WorkoutSession.find).toHaveBeenCalledWith({ client: req.session.user.id });
            expect(res.render).toHaveBeenCalledWith('client/workouts', expect.objectContaining({
                sessions: expect.arrayContaining([
                    expect.objectContaining({ client: req.session.user.id })
                ]),
                activePage: 'workouts'
            }));
            expect(next).not.toHaveBeenCalled();
        });
    });
});
