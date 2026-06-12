const Timesheet = require('../models/timesheetModel.js');

async function getOpenEntry(staffId) {
    return Timesheet.findOne({ staff: staffId, status: 'Open' }).sort({ checkIn: -1 });
}

exports.checkIn = async (staffId, branchId) => {
    const open = await getOpenEntry(staffId);
    if (open) {
        throw new Error('Bạn đang có ca chấm công chưa check-out. Vui lòng kết thúc ca trước.');
    }
    return Timesheet.create({
        staff: staffId,
        branch: branchId,
        checkIn: new Date(),
        status: 'Open'
    });
};

exports.checkOut = async (staffId) => {
    const open = await getOpenEntry(staffId);
    if (!open) {
        throw new Error('Không có ca đang mở. Hãy check-in trước.');
    }
    open.checkOut = new Date();
    open.status = 'Pending_Approval';
    await open.save();
    return open;
};

function monthRange(month, year) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
}

exports.listForMonth = async ({ month, year, staffId, branchId, status }) => {
    const { start, end } = monthRange(month, year);
    const filter = { checkIn: { $gte: start, $lte: end } };
    if (staffId) filter.staff = staffId;
    if (branchId && branchId !== 'all') filter.branch = branchId;
    if (status && status !== 'all') filter.status = status;

    return Timesheet.find(filter)
        .populate('staff', 'name role avatar')
        .populate('branch', 'name')
        .populate('approvedBy', 'name')
        .sort({ checkIn: -1 });
};

exports.countApprovedShifts = async (staffId, month, year) => {
    const { start, end } = monthRange(month, year);
    return Timesheet.countDocuments({
        staff: staffId,
        status: 'Approved',
        checkIn: { $gte: start, $lte: end },
        checkOut: { $exists: true, $ne: null }
    });
};

exports.approve = async (id, managerId, note) => {
    const entry = await Timesheet.findById(id);
    if (!entry) throw new Error('Không tìm thấy bản ghi chấm công');
    if (!entry.checkOut) throw new Error('Ca chưa check-out, không thể duyệt');
    entry.status = 'Approved';
    entry.approvedBy = managerId;
    entry.approvedAt = new Date();
    if (note) entry.managerNote = note;
    await entry.save();
    return entry;
};

exports.reject = async (id, managerId, note) => {
    const entry = await Timesheet.findById(id);
    if (!entry) throw new Error('Không tìm thấy bản ghi chấm công');
    entry.status = 'Rejected';
    entry.approvedBy = managerId;
    entry.approvedAt = new Date();
    if (note) entry.managerNote = note;
    await entry.save();
    return entry;
};

exports.getTodaySummary = async (staffId) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const entries = await Timesheet.find({
        staff: staffId,
        checkIn: { $gte: start, $lte: end }
    }).sort({ checkIn: -1 });
    const open = entries.find((e) => e.status === 'Open');
    return { entries, openEntry: open || null };
};
