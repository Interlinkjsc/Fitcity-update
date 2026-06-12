const notificationService = require('../modules/platform/services/notificationService');

/**
 * Middleware to fetch unread notifications for the logged-in user
 */
exports.fetchNotifications = async (req, res, next) => {
    // Skip if not logged in
    if (!req.session || !req.session.user) {
        res.locals.notifications = [];
        return next();
    }

    try {
        const notifications = await notificationService.getUnreadNotifications(req.session.user.id);
        res.locals.notifications = notifications || [];
        next();
    } catch (err) {
        console.error('[Notification Middleware] Error:', err);
        res.locals.notifications = [];
        next();
    }
};
