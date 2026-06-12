const { AppError } = require('../core/AppError');

const errorHandler = (err, req, res, next) => {
    if (process.env.NODE_ENV !== 'production') console.error(err);

    const fromErr =
        err instanceof AppError ||
        (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600);
    const statusCode = fromErr && err.statusCode
        ? err.statusCode
        : (res.statusCode === 200 ? 500 : res.statusCode);

    res.status(statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };
