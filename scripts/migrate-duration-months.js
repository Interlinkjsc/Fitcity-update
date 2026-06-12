/**
 * Đồng bộ durationMonths cho gói tập và snapshot HĐ (chạy một lần).
 * Usage: node scripts/migrate-duration-months.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ServicePackage = require('../src/modules/programs/models/servicePackageModel');
const Contract = require('../src/modules/contracts/models/contractModel');
const { daysToMonths, snapshotDurationFields } = require('../src/utils/contractDurationHelper');

async function run() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';
    await mongoose.connect(uri);

    let pkgUpdated = 0;
    const packages = await ServicePackage.find({});
    for (const pkg of packages) {
        if (pkg.durationMonths == null && pkg.duration != null) {
            pkg.durationMonths = daysToMonths(pkg.duration);
            await pkg.save();
            pkgUpdated += 1;
        }
    }

    let contractUpdated = 0;
    const contracts = await Contract.find({ 'packageSnapshot.duration': { $exists: true } });
    for (const c of contracts) {
        const snap = c.packageSnapshot;
        if (!snap?.durationMonths && snap?.duration) {
            const fields = snapshotDurationFields(daysToMonths(snap.duration));
            c.packageSnapshot.durationMonths = fields.durationMonths;
            c.packageSnapshot.duration = fields.duration;
            await c.save();
            contractUpdated += 1;
        }
    }

    console.log(`Packages updated: ${pkgUpdated}`);
    console.log(`Contract snapshots updated: ${contractUpdated}`);
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
