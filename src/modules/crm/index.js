module.exports = {
    controllers: {
        leadController: require('./controllers/leadController'),
        branchController: require('./controllers/branchController'),
        violationController: require('./controllers/violationController')
    },
    models: {
        leadModel: require('./models/leadModel'),
        branchModel: require('./models/branchModel'),
        violationModel: require('./models/violationModel')
    },
    services: {},
    routes: {
        leadRoutes: require('./routes/leadRoutes'),
        branchRoutes: require('./routes/branchRoutes'),
        violationRoutes: require('./routes/violationRoutes')
    }
};
