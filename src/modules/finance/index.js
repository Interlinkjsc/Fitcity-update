module.exports = {
    controllers: {
        expenseController: require('./controllers/expenseController'),
        payrollController: require('./controllers/payrollController'),
        couponController: require('./controllers/couponController')
    },
    models: {
        expenseModel: require('./models/expenseModel'),
        payrollModel: require('./models/payrollModel'),
        couponModel: require('./models/couponModel'),
        transactionModel: require('./models/transactionModel')
    },
    services: {
        payrollService: require('./services/payrollService'),
        reportService: require('../platform/services/reportService'),
        paymentService: require('../contracts/services/paymentService')
    },
    routes: {
        expenseRoutes: require('./routes/expenseRoutes'),
        payrollRoutes: require('./routes/payrollRoutes'),
        couponRoutes: require('./routes/couponRoutes')
    }
};
