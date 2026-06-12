module.exports = {
    controllers: {
        homeController: require('./controllers/homeController')
    },
    models: {
        notificationModel: require('./models/notificationModel')
    },
    services: {
        notificationService: require('./services/notificationService'),
        socketService: require('./services/socketService'),
        driveService: require('./services/driveService'),
        pdfService: require('../contracts/services/pdfService'),
        reportService: require('./services/reportService')
    },
    routes: {}
};

