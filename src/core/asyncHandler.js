/**
 * Bọc async handler Express: Promise rejection -> next(err).
 * @param {Function} fn async (req, res, next) => ...
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(fn) {
    return function asyncHandlerWrapped(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { asyncHandler };
