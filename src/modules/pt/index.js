module.exports = {
    controllers: {
        ptController: require('./controllers/ptController'),
        ptChangeRequestController: require('./controllers/ptChangeRequestController'),
        adminSlotController: require('./controllers/adminSlotController')
    },
    models: {
        ptChangeRequestModel: require('./models/ptChangeRequestModel')
    },
    services: {},
    routes: {
        ptRoutes: require('./routes/ptRoutes'),
        slotRoutes: require('./routes/slotRoutes'),
        ptChangeRequestRoutes: require('./routes/ptChangeRequestRoutes')
    }
};

