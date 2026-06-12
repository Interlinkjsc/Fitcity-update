const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { validateEnv } = require('../config/validateEnv');
const connectDB = require('../config/db');
const { startCronJobs } = require('./cronjobs');

validateEnv();

connectDB().then(() => {
    startCronJobs();
    console.log('[cron] Daily jobs scheduled (00:00 UTC server time)');
});
