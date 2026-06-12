module.exports = {
    controllers: {
        clientController: require('./controllers/clientController'),
        clientScheduleController: require('./controllers/clientScheduleController'),
        clientManagementController: require('./controllers/clientManagementController')
    },
    models: {
        userModel: require('../users/models/userModel'),
        workoutSessionModel: require('../programs/models/workoutSessionModel'),
        workoutProgramModel: require('../programs/models/workoutProgramModel')
    },
    services: {
        clientManagementService: require('./services/clientManagementService')
    },

    routes: {
        clientRoutes: require('./routes/clientRoutes'),
        clientAdminRoutes: require('./routes/adminClientsRoutes')
    }
};
