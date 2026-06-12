const REQUIRED_IN_PRODUCTION = [
    'SESSION_SECRET',
    'MONGODB_URI',
    'ENCRYPTION_KEY',
    'QR_HMAC_SECRET'
];

function validateEnv() {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        console.error(
            `[config] Missing required environment variables in production: ${missing.join(', ')}`
        );
        process.exit(1);
    }
}

module.exports = { validateEnv };
