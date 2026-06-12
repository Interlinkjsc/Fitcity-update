const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/** Liveness: process is up (used by orchestrators / simple pings). */
router.get('/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        db: { connected: dbConnected }
    });
});

/** Readiness: can serve traffic (DB must be connected). */
router.get('/ready', (req, res) => {
    if (mongoose.connection.readyState === 1) {
        return res.status(200).json({ ready: true });
    }
    res.status(503).json({ ready: false, dbState: mongoose.connection.readyState });
});

module.exports = router;
