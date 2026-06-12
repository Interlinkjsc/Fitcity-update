module.exports = {
    controllers: {
        mealPlanController: require('./controllers/mealPlanController'),
        rewardController: require('./controllers/rewardController'),
        metricController: require('./controllers/metricController'),
        kpiController: require('./controllers/kpiController'),
        packageController: require('./controllers/packageController')
    },
    models: {
        mealPlanModel: require('./models/mealPlanModel'),
        rewardModel: require('./models/rewardModel'),
        bodyMetricModel: require('./models/bodyMetricModel'),
        kpiModel: require('./models/kpiModel'),
        servicePackageModel: require('./models/servicePackageModel'),
        workoutProgramModel: require('./models/workoutProgramModel'),
        workoutSessionModel: require('./models/workoutSessionModel')
    },
    services: {
        rewardService: require('./services/rewardService'),
        workoutService: require('./services/workoutService')
    },
    routes: {
        mealPlanRoutes: require('./routes/mealPlanRoutes'),
        rewardRoutes: require('./routes/rewardRoutes'),
        metricRoutes: require('./routes/metricRoutes'),
        kpiRoutes: require('./routes/kpiRoutes'),
        packageRoutes: require('./routes/packageRoutes')
    }
};
