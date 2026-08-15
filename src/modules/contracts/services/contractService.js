const Contract = require('../models/contractModel.js');
const ServicePackage = require('../../programs/models/servicePackageModel.js');
const Coupon = require('../../finance/models/couponModel.js');
const User = require('../../users/models/userModel.js');
const {
    resolveDurationMonths,
    addMonthsToDate,
    snapshotDurationFields
} = require('../../../utils/contractDurationHelper');
const systemSettingsService = require('../../platform/services/systemSettingsService');

/** PT commission: % of netAmount (before VAT). */
const DEFAULT_PT_COMMISSION_RATE = 10;
exports.DEFAULT_PT_COMMISSION_RATE = DEFAULT_PT_COMMISSION_RATE;

/**
 * Lấy % HH PT: ưu tiên tham số truyền vào, sau đó profile PT, cuối cùng mặc định 10%.
 */
exports.resolvePtCommissionRate = async (ptId, explicitRate) => {
    if (explicitRate !== undefined && explicitRate !== null && String(explicitRate).trim() !== '') {
        const r = Number(explicitRate);
        if (Number.isFinite(r) && r >= 0) return Math.min(100, r);
    }
    const settings = await systemSettingsService.getGlobalSettings();
    const systemDefault = Number(settings?.defaultPtCommissionRate);
    const fallback =
        Number.isFinite(systemDefault) && systemDefault >= 0
            ? Math.min(100, systemDefault)
            : DEFAULT_PT_COMMISSION_RATE;

    if (!ptId) return fallback;
    const pt = await User.findById(ptId).select('ptCommissionRate').lean();
    // Nếu PT đã set tường minh (kể cả 0%), dùng giá trị đó — không fallback
    if (pt && pt.ptCommissionRate !== undefined && pt.ptCommissionRate !== null) {
        const r = Number(pt.ptCommissionRate);
        if (Number.isFinite(r)) return Math.max(0, Math.min(100, r));
    }
    return fallback;
};

/**
 * Calculate total amount for contract including VAT (after discount)
 * Formula: Math.round((basePrice - discount) * (1 + vat / 100))
 */
/**
 * Suy ra nguồn thu từ gói / PT (có thể ghi đè bằng revenueSource trên form).
 */
exports.inferRevenueSource = ({ ptId, packageType, sessions, explicit }) => {
    const allowed = ['PT_Contract', 'Other'];
    if (explicit && allowed.includes(explicit)) return explicit;
    if (ptId && Number(sessions) > 0) return 'PT_Contract';
    return 'Other';
};

exports.calculateTotalAmount = (basePrice, discount = 0, vat = 10) => {
    const finalDiscount = Math.min(discount, basePrice);
    const afterDiscount = basePrice - finalDiscount;
    const total = afterDiscount * (1 + vat / 100);
    return Math.round(total);
};

/**
 * Business Logic to create a new Contract
 * Supports 2 modes:
 *   - Template mode: packageId is provided → fetch from DB
 *   - Custom mode:   customPackage { name, type, durationMonths, sessions, price } is provided
 * Price semantics: package/custom `price` = unit price per session (VNĐ/buổi).
 * basePrice = unitPrice * totalSessions; ptCommission = netAmount * rate%.
 */
exports.createContract = async (data) => {
    const { 
        packageId, customPackage,
        clientId, branchId, salesId, ptId, 
        discount = 0, couponCode, startDate = new Date(),
        ptCommissionRate: explicitPtRate,
        revenueSource: explicitRevenueSource
    } = data;

    const ptCommissionRate = await exports.resolvePtCommissionRate(ptId, explicitPtRate);

    let pkgName, pkgType, pkgDurationMonths, pkgSessions, unitPrice, isCustom;

    if (packageId) {
        // ===== TEMPLATE MODE =====
        const pkg = await ServicePackage.findById(packageId);
        if (!pkg) throw new Error('Gói tập không tồn tại');
        pkgName = pkg.name;
        pkgType = pkg.type;
        pkgDurationMonths = resolveDurationMonths(pkg);
        pkgSessions = pkg.sessions || 0;
        unitPrice = pkg.price;
        isCustom = false;
    } else if (customPackage) {
        // ===== CUSTOM MODE =====
        if (!customPackage.name || customPackage.price == null) {
            throw new Error('Gói tập tuỳ chỉnh thiếu thông tin bắt buộc (Tên, Thời hạn, Giá/buổi)');
        }
        pkgDurationMonths = resolveDurationMonths(customPackage);
        if (!pkgDurationMonths) {
            throw new Error('Gói tập tuỳ chỉnh thiếu thời hạn (tháng)');
        }
        pkgName = customPackage.name;
        pkgType = customPackage.type || 'Gym';
        pkgSessions = Number(customPackage.sessions) || 0;
        unitPrice = Number(customPackage.price);
        isCustom = true;
    } else {
        throw new Error('Vui lòng chọn gói tập có sẵn hoặc tạo gói tuỳ chỉnh');
    }

    if (pkgSessions < 1) {
        throw new Error('Tổng số buổi tập của hợp đồng phải lớn hơn 0');
    }

    const basePrice = unitPrice * pkgSessions;

    let finalDiscount = Number(discount) || 0;
    let appliedCoupon = null;

    // Process Coupon if provided
    if (couponCode) {
        const coupon = await Coupon.findOne({ 
            code: couponCode.toUpperCase(), 
            active: true,
            endDate: { $gte: new Date() },
            usageLimit: { $gt: 0 }
        });

        if (coupon) {
            if (coupon.type === 'FreeSessions') {
                throw new Error(
                    'Mã loại tặng buổi tập không áp dụng khi tạo hợp đồng. Vui lòng dùng mã giảm giá % hoặc số tiền, hoặc tặng buổi qua mục Khuyến mãi / Quản lý khách hàng.'
                );
            }
            if (coupon.type === 'Percentage') {
                let couponDiscount = (basePrice * coupon.value) / 100;
                if (coupon.maxDiscount > 0) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
                finalDiscount += couponDiscount;
            } else {
                finalDiscount += coupon.value;
            }
            appliedCoupon = coupon._id;
            
            // Increment usage
            coupon.usageCount += 1;
            coupon.usageLimit -= 1;
            await coupon.save();
        } else {
            throw new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn');
        }
    }

    // Calculate financial values (basePrice = unitPrice * sessions)
    const finalDiscountBounded = Math.min(finalDiscount, basePrice);
    const netAmount = basePrice - finalDiscountBounded;
    const ptRate = ptCommissionRate;
    // Bug 1.2: chỉ tính ptCommission khi PT chính là người chốt HĐ (pt === sales)
    const ptIsSales = ptId && salesId && ptId.toString() === salesId.toString();
    const ptCommission = ptIsSales ? Math.round(netAmount * (ptRate / 100)) : 0;
    const globalSettings = await systemSettingsService.getGlobalSettings();
    const vatPercent = Number(globalSettings?.defaultVat);
    const vat = Number.isFinite(vatPercent) && vatPercent >= 0 ? Math.min(100, vatPercent) : 10;
    const totalAmount = this.calculateTotalAmount(basePrice, finalDiscountBounded, vat);

      const durationFields = snapshotDurationFields(pkgDurationMonths);
    const start = new Date(startDate);
    const end = addMonthsToDate(start, pkgDurationMonths);

    // Create record with snapshot
    const revenueSource = exports.inferRevenueSource({
        ptId,
        packageType: pkgType,
        sessions: pkgSessions,
        explicit: explicitRevenueSource
    });

    // Bug 23/7 A14 + Rp15/8 ISSUE 0: mã HĐ DD.MM.YYYY/<viết tắt KH> — helper dùng chung, ưu tiên mã khách tự điền.
    const userCode = (data.contractCode || '').trim() || undefined;
    let clientName = '';
    if (!userCode) {
        try {
            const User = require('../../users/models/userModel');
            const clientDoc = await User.findById(clientId).select('name').lean();
            clientName = clientDoc && clientDoc.name ? clientDoc.name : '';
        } catch (_) { /* fallback: mã chỉ theo ngày */ }
    }
    const { generateContractCode } = require('../../../utils/contractCode');
    const existsFn = (code) => Contract.exists({ contractCode: code }).then(Boolean);

    const payload = {
        client: clientId,
        servicePackage: packageId || undefined,
        packageSnapshot: {
            name: pkgName,
            type: pkgType,
            ...durationFields,
            sessions: pkgSessions,
            price: unitPrice,
            isCustom: isCustom
        },
        branch: branchId,
        sales: salesId,
        pt: ptId,
        startDate: start,
        endDate: end,
        basePrice,
        discount: finalDiscountBounded,
        coupon: appliedCoupon,
        vat,
        netAmount: netAmount,
        ptCommission: ptCommission,
        totalAmount: totalAmount,
        totalSessions: pkgSessions,
        remainingSessions: pkgSessions,
        contractStatus: 'Draft',
        paymentStatus: 'Unpaid',
        revenueSource
    };

    // QA2 (ISSUE 0): exists()→create() không atomic. Tạo đồng thời cùng viết tắt có thể đụng unique
    // contractCode → bắt E11000 và sinh candidate KẾ TIẾP rồi create lại (tối đa 5 lần). Mã nhập tay: không retry.
    let contract;
    let contractCode = userCode || await generateContractCode(clientName, existsFn);
    const MAX_ATTEMPTS = 8;
    for (let attempt = 1; ; attempt++) {
        try {
            contract = await Contract.create({ ...payload, contractCode });
            break;
        } catch (e) {
            const dupCode = e && e.code === 11000 && e.keyPattern && e.keyPattern.contractCode;
            if (!dupCode || userCode || attempt >= MAX_ATTEMPTS) throw e;
            // Race giữa nhiều request đồng thời: nếu chỉ hỏi lại existsFn thì các request lại cùng thấy
            // cùng 1 candidate kế tiếp và va nhau tiếp. → hậu tố = số thứ tự đã có + bước nhảy ngẫu nhiên nhỏ.
            const base = String(contractCode).replace(/-\d+$/, '');
            const cur = /-(\d+)$/.exec(contractCode);
            const n = (cur ? Number(cur[1]) : 1) + 1 + Math.floor(Math.random() * 3);
            contractCode = `${base}-${n}`;
            // vẫn tôn trọng existsFn để không nhảy quá số đã dùng (best-effort)
            let guard = 0;
            while (guard++ < 20 && await existsFn(contractCode)) {
                const m = /-(\d+)$/.exec(contractCode);
                contractCode = `${base}-${Number(m[1]) + 1}`;
            }
        }
    }

    return contract;
};
