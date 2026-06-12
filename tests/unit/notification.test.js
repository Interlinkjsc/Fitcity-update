const notificationService = require('../../src/modules/platform/services/notificationService.js');
const notificationMiddleware = require('../../src/middlewares/notificationMiddleware');
const Notification = require('../../src/modules/platform/models/notificationModel');

jest.mock('../../src/modules/platform/models/notificationModel');

describe('Notification Module', () => {
    afterEach(() => jest.clearAllMocks());

    describe('Notification Service', () => {
        it('pushNotification should create a record', async () => {
            Notification.create.mockResolvedValue({ title: 'T' });
            const res = await notificationService.pushNotification('u1', 'Title', 'Msg');
            expect(res.title).toBe('T');
        });

        it('pushNotification should handle error', async () => {
            Notification.create.mockRejectedValue(new Error('err'));
            const res = await notificationService.pushNotification('u1', 'Title', 'Msg');
            expect(res).toBeNull();
        });

        it('getUnreadNotifications should return list', async () => {
            const mockFind = {
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([{ title: 'N1' }])
            };
            Notification.find.mockReturnValue(mockFind);
            const res = await notificationService.getUnreadNotifications('u1');
            expect(res[0].title).toBe('N1');
        });

        it('getUnreadNotifications should handle error', async () => {
            Notification.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), limit: jest.fn().mockRejectedValue(new Error('err')) });
            const res = await notificationService.getUnreadNotifications('u1');
            expect(res).toEqual([]);
        });

        it('markAsRead should update record', async () => {
            Notification.findByIdAndUpdate.mockResolvedValue({ read: true });
            const res = await notificationService.markAsRead('n1');
            expect(res.read).toBe(true);
        });

        it('markAsRead should handle error', async () => {
            Notification.findByIdAndUpdate.mockRejectedValue(new Error('err'));
            const res = await notificationService.markAsRead('n1');
            expect(res).toBeNull();
        });
    });

    describe('Notification Middleware', () => {
        let req, res, next;
        beforeEach(() => {
            req = { session: { user: { id: 'u1' } } };
            res = { locals: {} };
            next = jest.fn();
        });

        it('should skip if no session', async () => {
            req.session = null;
            await notificationMiddleware.fetchNotifications(req, res, next);
            expect(res.locals.notifications).toEqual([]);
            expect(next).toHaveBeenCalled();
        });

        it('should fetch and attach notifications', async () => {
            // Mock service
            const spy = jest.spyOn(notificationService, 'getUnreadNotifications').mockResolvedValue([{ title: 'N' }]);
            await notificationMiddleware.fetchNotifications(req, res, next);
            expect(res.locals.notifications).toHaveLength(1);
            expect(next).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should handle service error gracefully', async () => {
            const spy = jest.spyOn(notificationService, 'getUnreadNotifications').mockRejectedValue(new Error('err'));
            await notificationMiddleware.fetchNotifications(req, res, next);
            expect(res.locals.notifications).toEqual([]);
            expect(next).toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});
