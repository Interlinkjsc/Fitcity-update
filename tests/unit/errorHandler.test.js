const { errorHandler } = require('../../src/middlewares/errorHandler');

describe('Error Handler Middleware', () => {
    const mockReq = {};

    it('Should set status to 500 if res.statusCode is 200 (default)', () => {
        const err = new Error('Test error');
        const res = {
            statusCode: 200,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        errorHandler(err, mockReq, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Test error'
        }));
    });

    it('Should preserve non-200 status code', () => {
        const err = new Error('Not Found');
        const res = {
            statusCode: 404,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        errorHandler(err, mockReq, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('Should hide stack in production', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const err = new Error('Prod error');
        const res = {
            statusCode: 500,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        errorHandler(err, mockReq, res, jest.fn());

        const jsonArg = res.json.mock.calls[0][0];
        expect(jsonArg.stack).toBeNull();

        process.env.NODE_ENV = origEnv;
    });
});
