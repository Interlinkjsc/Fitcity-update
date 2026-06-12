const {
    monthsToDays,
    daysToMonths,
    resolveDurationMonths,
    addMonthsToDate,
    snapshotDurationFields,
    formatDurationLabel
} = require('../../src/utils/contractDurationHelper');

describe('contractDurationHelper', () => {
    it('monthsToDays and daysToMonths are inverse-ish', () => {
        expect(monthsToDays(3)).toBe(90);
        expect(daysToMonths(90)).toBe(3);
    });

    it('resolveDurationMonths prefers durationMonths', () => {
        expect(resolveDurationMonths({ durationMonths: 6 })).toBe(6);
        expect(resolveDurationMonths({ duration: 60 })).toBe(2);
    });

    it('snapshotDurationFields stores both fields', () => {
        expect(snapshotDurationFields(2)).toEqual({ durationMonths: 2, duration: 60 });
    });

    it('addMonthsToDate uses 30-day months', () => {
        const start = new Date(2026, 0, 15);
        const end = addMonthsToDate(start, 3);
        expect(end.getTime()).toBe(start.getTime() + 90 * 24 * 60 * 60 * 1000);
    });

    it('formatDurationLabel shows months', () => {
        expect(formatDurationLabel({ durationMonths: 12 })).toBe('12 tháng');
    });
});
