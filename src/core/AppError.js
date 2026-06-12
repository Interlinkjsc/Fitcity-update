/**
 * Lỗi nghiệp vụ có mã HTTP — dùng trong service/controller, errorHandler sẽ map sang status.
 */
class AppError extends Error {
    /**
     * @param {string} message
     * @param {number} [statusCode=400]
     */
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { AppError };
