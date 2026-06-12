const Lead = require('../models/leadModel');

const FUNNEL_STAGES = [
    { key: 'F', label: 'Khách F' },
    { key: 'Contacted', label: 'Đã liên hệ' },
    { key: 'Signed', label: 'Đã ký HĐ' },
    { key: 'Converted', label: 'Đã chuyển hội viên' }
];

async function getFunnelCounts(filter = {}) {
    const rows = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const stages = FUNNEL_STAGES.map((s) => ({
        ...s,
        count: map[s.key] || 0
    }));
    const total = stages.reduce((sum, s) => sum + s.count, 0);
    return { stages, total };
}

module.exports = {
    FUNNEL_STAGES,
    getFunnelCounts
};
