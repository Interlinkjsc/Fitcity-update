module.exports = {
    controllers: {
        contractController: require('./controllers/contractController'),
        paymentController: require('./controllers/paymentController')
    },
    models: {
        contractModel: require('./models/contractModel'),
        pauseRequestModel: require('./models/pauseRequestModel'),
        transactionModel: require('./models/transactionModel')
    },
    services: {
        contractService: require('./services/contractService'),
        contractPauseService: require('./services/contractPauseService'),
        contractLiquidationService: require('./services/contractLiquidationService'),
        paymentService: require('./services/paymentService'),
        pdfService: require('./services/pdfService')
    },
    routes: {
        contractRoutes: require('./routes/contractRoutes')
    }
};
