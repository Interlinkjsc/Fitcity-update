/**
 * Hợp đồng module feature: mọi module nên export cùng một dạng để tooling / đọc code thống nhất.
 */
const STANDARD_KEYS = ['controllers', 'models', 'services', 'routes'];

/**
 * @param {Partial<{ controllers: object, models: object, services: object, routes: object }>} partial
 * @returns {{ controllers: object, models: object, services: object, routes: object }}
 */
function defineModule(partial = {}) {
    const out = {};
    for (const key of STANDARD_KEYS) {
        const v = partial[key];
        out[key] = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    }
    return out;
}

/**
 * Kiểm tra nhanh khi bootstrap (tuỳ chọn gọi trong test hoặc dev).
 * @param {object} obj
 * @param {string} [featureName='module']
 */
function assertModuleShape(obj, featureName = 'module') {
    if (!obj || typeof obj !== 'object') {
        throw new TypeError(`[${featureName}] module export must be an object`);
    }
    for (const key of STANDARD_KEYS) {
        if (obj[key] !== undefined && (typeof obj[key] !== 'object' || obj[key] === null || Array.isArray(obj[key]))) {
            throw new TypeError(`[${featureName}] "${key}" must be a plain object`);
        }
    }
}

module.exports = {
    defineModule,
    assertModuleShape,
    STANDARD_KEYS
};
