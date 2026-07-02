const mongoose = require('mongoose');

const GLOBAL_VIEW_ROLES = ['SA', 'Admin', 'CEO', 'Accountant'];

function toObjectId(id) {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(id)) {
        return new mongoose.Types.ObjectId(id);
    }
    return null;
}

function userId(user) {
    return toObjectId(user?.id || user?._id);
}

/**
 * Mongo filter for contract list / aggregates.
 * @param {object} user - req.session.user
 * @param {{ branchId?: string, status?: string }} query
 */
function buildContractListFilter(user, query = {}) {
    if (!user) return { _id: null };

    const role = user.role;
    const uid = userId(user);
    const conditions = [];

    if (role === 'Manager') {
        const branchId = toObjectId(user.branch);
        const orClause = [{ sales: uid }, { pt: uid }];
        if (branchId) orClause.unshift({ branch: branchId });
        conditions.push({ $or: orClause });
    } else if (role === 'Sales') {
        conditions.push({ sales: uid });
    } else if (role === 'PT') {
        conditions.push({ $or: [{ pt: uid }, { sales: uid }] });
    } else if (role === 'Client') {
        conditions.push({ client: uid });
    }

    if (query.branchId) {
        const branchOid = toObjectId(query.branchId);
        if (GLOBAL_VIEW_ROLES.includes(role)) {
            conditions.push({ branch: branchOid });
        } else if (role === 'Manager' && user.branch?.toString() === query.branchId) {
            conditions.push({ branch: branchOid });
        }
    }

    if (query.status && query.status !== 'all') {
        const statusMap = {
            frozen: { contractStatus: 'Paused' },
            liquidated: { contractStatus: 'Liquidated' },
            paid: { paymentStatus: 'Paid' },
            unpaid: { paymentStatus: { $ne: 'Paid' } }
        };
        if (statusMap[query.status]) conditions.push(statusMap[query.status]);
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
}

/**
 * @param {object} user
 * @param {object} contract - plain or mongoose doc
 */
function canAccessContract(user, contract) {
    if (!user || !contract) return false;
    if (user.role === 'SA') return true;
    if (GLOBAL_VIEW_ROLES.includes(user.role)) return true;

    const uid = userId(user)?.toString();
    const branchId = user.branch?.toString();
    const cBranch = contract.branch?._id?.toString() || contract.branch?.toString();
    const cSales = contract.sales?._id?.toString() || contract.sales?.toString();
    const cPt = contract.pt?._id?.toString() || contract.pt?.toString();
    const cClient = contract.client?._id?.toString() || contract.client?.toString();

    if (user.role === 'Manager') {
        return (branchId && cBranch === branchId) || cSales === uid || cPt === uid;
    }
    if (user.role === 'Sales') return cSales === uid;
    if (user.role === 'PT') return cPt === uid || cSales === uid;
    if (user.role === 'Client') return cClient === uid;
    return false;
}

/** Revenue field for KPI: netAmount with fallback */
const NET_AMOUNT_EXPR = {
    $ifNull: [
        '$netAmount',
        { $subtract: ['$basePrice', { $ifNull: ['$discount', 0] }] }
    ]
};

function revenueAggregateGroup() {
    return {
        _id: null,
        totalNet: { $sum: NET_AMOUNT_EXPR },
        totalAfterTax: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        count: { $sum: 1 }
    };
}

/** Flash message when contract scope denies access */
const ACCESS_DENIED_MSG = 'Bạn không có quyền truy cập hợp đồng này.';

module.exports = {
    buildContractListFilter,
    canAccessContract,
    ACCESS_DENIED_MSG,
    revenueAggregateGroup,
    NET_AMOUNT_EXPR,
    GLOBAL_VIEW_ROLES
};
