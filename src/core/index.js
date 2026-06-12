/**
 * Bộ lõi tái sử dụng: lỗi chuẩn, async handler, hợp đồng module, gắn HTTP.
 * Import: `const { AppError, asyncHandler, defineModule } = require('./core');`
 */
const { AppError } = require('./AppError');
const { asyncHandler } = require('./asyncHandler');
const { defineModule, assertModuleShape, STANDARD_KEYS } = require('./moduleKit');
const { mountFeatureRouters, mountDashboardRoutes } = require('./httpMount');

module.exports = {
    AppError,
    asyncHandler,
    defineModule,
    assertModuleShape,
    STANDARD_KEYS,
    mountFeatureRouters,
    mountDashboardRoutes
};
