/**
 * Integration test config: runs tests serially (runInBand) to prevent
 * interference between suites sharing the same MongoDB database.
 */
const base = require('./jest.config');

module.exports = {
    ...base,
    maxWorkers: 1,
    testPathIgnorePatterns: [
        ...base.testPathIgnorePatterns.filter(p => p !== '/tests/e2e/'),
        '/tests/unit/',
        '/tests/e2e/'
    ]
};
