const socketIO = require('socket.io');

let io;
const onlineUsers = new Map(); // Map<socketId, {userId, role}>

exports.init = (server) => {
    io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        socket.on('identify', (userData) => {
            // userData: { userId, role }
            if (userData && userData.userId) {
                onlineUsers.set(socket.id, userData);
                this.broadcastOnlineCount();
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            onlineUsers.delete(socket.id);
            this.broadcastOnlineCount();
        });
    });

    return io;
};

exports.getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

exports.broadcastOnlineCount = () => {
    if (io) {
        // Count unique UserIDs to avoid double counting same user on multiple tabs
        const uniqueUserIds = new Set();
        onlineUsers.forEach(data => uniqueUserIds.add(data.userId));
        
        io.emit('onlineCount', uniqueUserIds.size);
    }
};

/**
 * Gửi thông báo realtime cho một user cụ thể
 */
exports.sendToUser = (userId, event, data) => {
    if (io) {
        onlineUsers.forEach((userData, socketId) => {
            if (userData.userId === userId.toString()) {
                io.to(socketId).emit(event, data);
            }
        });
    }
};
