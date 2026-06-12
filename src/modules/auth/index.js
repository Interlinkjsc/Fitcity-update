module.exports = {
    controllers: {
        authController: require('./controllers/authController')
    },
    models: {
        roleModel: require('../users/models/roleModel'),
        userModel: require('../users/models/userModel')
    },
    services: {},
    routes: {
        authRoutes: require('./routes/authRoutes')
    }
};
