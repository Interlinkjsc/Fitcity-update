const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { validateEnv } = require('./config/validateEnv');
validateEnv();
const app = require('./app');
const connectDB = require('./config/db');
const socketService = require('./modules/platform/services/socketService.js');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
socketService.init(server);

// Connect to Database
connectDB();

// Cron runs in separate container in production (deploy/docker/docker-compose.yml)
if (process.env.NODE_ENV !== 'production') {
    const { startCronJobs } = require('./cron/cronjobs');
    startCronJobs();
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
// Trigger nodemon restart