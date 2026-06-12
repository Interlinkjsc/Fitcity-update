const metricController = require('../../src/modules/programs/controllers/metricController.js');
const BodyMetric = require('../../src/modules/programs/models/bodyMetricModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const notificationService = require('../../src/modules/platform/services/notificationService.js');

describe('Metric Controller', () => {
    const mockRes = () => {
        const res = {};
        res.render = jest.fn().mockReturnValue(res);
        res.redirect = jest.fn().mockReturnValue(res);
        return res;
    };

    afterEach(() => jest.restoreAllMocks());

    describe('getMyClientsForMetrics', () => {
        it('Should render pt/metrics/clients', async () => {
            jest.spyOn(Contract, 'find').mockImplementation(() => ({
                populate: jest.fn().mockImplementation(() => ({
                    populate: jest.fn().mockResolvedValue([])
                }))
            }));
            
            const req = { session: { user: { id: '507f191e810c19729de860ea' } } };
            const res = mockRes();
            const next = jest.fn();

            await metricController.getMyClientsForMetrics(req, res, next);
            expect(res.render).toHaveBeenCalled();
        });
    });

    describe('getMetricHistory', () => {
        it('Should render history when PT owns client', async () => {
            jest.spyOn(Contract, 'findOne').mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    client: { _id: '507f191e810c19729de860ec', name: 'Client A' }
                })
            });
            jest.spyOn(BodyMetric, 'find').mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            });

            const req = {
                params: { clientId: '507f191e810c19729de860ec' },
                session: { user: { id: '507f191e810c19729de860ea' } },
                flash: jest.fn()
            };
            const res = mockRes();
            const next = jest.fn();

            await metricController.getMetricHistory(req, res, next);
            expect(res.render).toHaveBeenCalledWith('pt/metrics/history', expect.objectContaining({
                metrics: expect.any(Array)
            }));
        });

        it('Should redirect when PT does not own client', async () => {
            jest.spyOn(Contract, 'findOne').mockReturnValue({
                populate: jest.fn().mockResolvedValue(null)
            });

            const req = {
                params: { clientId: '507f191e810c19729de860ec' },
                session: { user: { id: '507f191e810c19729de860ea' } },
                flash: jest.fn()
            };
            const res = mockRes();
            const next = jest.fn();

            await metricController.getMetricHistory(req, res, next);
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/pt/metrics');
        });
    });

    describe('saveBodyMetric', () => {
        it('Should create body metric and redirect with success message', async () => {
            jest.spyOn(BodyMetric, 'create').mockResolvedValue({ id: '507f191e810c19729de860eb' });
            jest.spyOn(notificationService, 'pushNotification').mockResolvedValue(true);
            
            const req = { 
                params: { clientId: '507f191e810c19729de860ec' },
                session: { user: { id: '507f191e810c19729de860ea' } },
                body: { weight: 75, height: 175 },
                flash: jest.fn()
            };
            const res = mockRes();
            const next = jest.fn();

            await metricController.saveBodyMetric(req, res, next);

            expect(BodyMetric.create).toHaveBeenCalled();
            expect(req.flash).toHaveBeenCalledWith('success_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/pt/metrics');
        });
    });

    describe('getMyProgress', () => {
        it('Should render client/progress', async () => {
            jest.spyOn(BodyMetric, 'find').mockImplementation(() => ({
                sort: jest.fn().mockResolvedValue([])
            }));
            
            const req = { session: { user: { id: '507f191e810c19729de860ec' } }, query: {} };
            const res = mockRes();
            const next = jest.fn();

            await metricController.getMyProgress(req, res, next);
            expect(res.render).toHaveBeenCalled();
        });
    });
});
