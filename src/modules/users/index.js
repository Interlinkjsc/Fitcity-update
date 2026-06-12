module.exports = {
    controllers: {
        userController: require('./controllers/userController')
    },
    models: {
        userModel: require('./models/userModel')
    },
    services: {},
    routes: {
        userRoutes: require('./routes/userRoutes')
    }
};
