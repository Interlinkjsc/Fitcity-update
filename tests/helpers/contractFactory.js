const mongoose = require('mongoose');

function packageSnapshot(overrides = {}) {
    return {
        name: 'Test Package',
        type: 'Gym',
        duration: 30,
        price: 1_000_000,
        sessions: 12,
        isCustom: false,
        ...overrides
    };
}

function contractPayload(overrides = {}) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const snap = overrides.packageSnapshot
        ? packageSnapshot(overrides.packageSnapshot)
        : packageSnapshot();
    const { packageSnapshot: _snap, ...rest } = overrides;

    return {
        client: new mongoose.Types.ObjectId(),
        servicePackage: new mongoose.Types.ObjectId(),
        branch: new mongoose.Types.ObjectId(),
        sales: new mongoose.Types.ObjectId(),
        packageSnapshot: snap,
        basePrice: 1_000_000,
        totalAmount: 1_100_000,
        paymentStatus: 'Unpaid',
        contractStatus: 'Draft',
        startDate: now,
        endDate: end,
        paymentDeadline: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        ...rest
    };
}

module.exports = { contractPayload, packageSnapshot };
