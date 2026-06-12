const SystemSettings = require('../models/systemSettingsModel.js');

const GLOBAL_KEY = 'global';

async function getGlobalSettings() {
    let doc = await SystemSettings.findOne({ key: GLOBAL_KEY }).lean();
    if (!doc) {
        const created = await SystemSettings.create({ key: GLOBAL_KEY });
        doc = created.toObject();
    }
    return doc;
}

async function updateGlobalSettings(payload) {
    const { defaultVat, defaultPtCommissionRate, ptPayrollMode, timesheetRatePerShift, updatedBy } =
        payload;
    const clamp = (v, fallback) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return fallback;
        return Math.min(100, n);
    };
    const clampMoney = (v, fallback) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return fallback;
        return Math.round(n);
    };

    const update = {
        defaultVat: defaultVat !== undefined ? clamp(defaultVat, 10) : undefined,
        defaultPtCommissionRate:
            defaultPtCommissionRate !== undefined ? clamp(defaultPtCommissionRate, 10) : undefined,
        ptPayrollMode:
            ptPayrollMode && ['contract', 'timesheet', 'hybrid'].includes(ptPayrollMode)
                ? ptPayrollMode
                : undefined,
        timesheetRatePerShift:
            timesheetRatePerShift !== undefined ? clampMoney(timesheetRatePerShift, 120000) : undefined,
        updatedBy
    };

    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    return SystemSettings.findOneAndUpdate(
        { key: GLOBAL_KEY },
        { $set: update, $setOnInsert: { key: GLOBAL_KEY } },
        { upsert: true, new: true }
    ).lean();
}

module.exports = {
    getGlobalSettings,
    updateGlobalSettings
};
