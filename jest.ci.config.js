/** CI gate config: stable unit tests. Full suite: npm test / jest without this config. */
const base = require('./jest.config');

module.exports = {
    ...base,
    testPathIgnorePatterns: [
        ...base.testPathIgnorePatterns,
        '/tests/integration/',
        'homeController.test.js',
        'rbac.test.js',
        'calendar.test.js',
        'clientController.test.js',
        'contractController.errors.test.js',
        'contractModel.test.js',
        'contractPauseService.test.js',
        'models.test.js',
        'more_controllers.errors.test.js',
        'ptDashboard.test.js',
        'servicePackage.test.js'
    ]
};
