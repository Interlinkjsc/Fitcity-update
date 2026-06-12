const Notification = require('../models/notificationModel');

/**
 * Push a new notification to a user
 */
exports.pushNotification = async (recipientId, title, message, type = 'Info', link = null, senderId = null) => {
    try {
        const noti = await Notification.create({
            recipient: recipientId,
            sender: senderId,
            title,
            message,
            type,
            link
        });
        return noti;
    } catch (err) {
        console.error('[Notification Service] Error pushing notification:', err);
        return null;
    }
};

/**
 * Get unread notifications for a user
 */
exports.getUnreadNotifications = async (userId) => {
    try {
        return await Notification.find({ recipient: userId, read: false })
            .sort({ createdAt: -1 })
            .limit(10);
    } catch (err) {
        console.error('[Notification Service] Error fetching notifications:', err);
        return [];
    }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (notificationId) => {
    try {
        return await Notification.findByIdAndUpdate(notificationId, { read: true }, { new: true });
    } catch (err) {
        return null;
    }
};
