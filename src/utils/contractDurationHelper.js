/** Chuẩn hóa thời hạn HĐ/gói tập theo tháng (1 tháng = 30 ngày lưu legacy). */
const DAYS_PER_MONTH = 30;

function monthsToDays(months) {
    const m = Number(months);
    if (!Number.isFinite(m) || m < 1) return DAYS_PER_MONTH;
    return Math.round(m * DAYS_PER_MONTH);
}

function daysToMonths(days) {
    const d = Number(days);
    if (!Number.isFinite(d) || d <= 0) return 1;
    return Math.max(1, Math.round(d / DAYS_PER_MONTH));
}

function resolveDurationMonths(source = {}) {
    if (source.durationMonths != null && source.durationMonths !== '') {
        return Math.max(1, Number(source.durationMonths));
    }
    if (source.duration != null && source.duration !== '') {
        return daysToMonths(source.duration);
    }
    return 1;
}

/** Cộng thời hạn theo quy ước 1 tháng = 30 ngày (khớp snapshot.duration). */
function addMonthsToDate(startDate, months) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + monthsToDays(months));
    return end;
}

function snapshotDurationFields(months) {
    const m = Math.max(1, Number(months) || 1);
    return {
        durationMonths: m,
        duration: monthsToDays(m)
    };
}

function formatDurationLabel(source = {}) {
    const months = resolveDurationMonths(source);
    return `${months} tháng`;
}

module.exports = {
    DAYS_PER_MONTH,
    monthsToDays,
    daysToMonths,
    resolveDurationMonths,
    addMonthsToDate,
    snapshotDurationFields,
    formatDurationLabel
};
