const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    contractCode: {
        type: String,
        unique: true,
        index: true
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Khách hàng là bắt buộc']
    },
    servicePackage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServicePackage'
        // No longer required — can be null for custom packages
    },
    // Snapshot: lưu bản sao thông tin gói tập tại thời điểm ký HĐ
    packageSnapshot: {
        name: { type: String, required: [true, 'Tên gói tập là bắt buộc'] },
        type: { type: String, default: 'Gym' },
        durationMonths: { type: Number, min: 1 },
        duration: { type: Number, required: [true, 'Thời hạn gói tập là bắt buộc'] },
        sessions: { type: Number, default: 0 },
        price: { type: Number, required: [true, 'Giá gói tập là bắt buộc'] },
        isCustom: { type: Boolean, default: false }
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Chi nhánh là bắt buộc']
    },
    sales: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Nhân viên kinh doanh là bắt buộc']
    },
    pt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Optional because not all contracts (Gym) need a PT
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: [true, 'Ngày hết hạn là bắt buộc'],
        validate: {
            validator: function(value) {
                // Ensure we have a startDate to compare with
                const start = this.startDate || new Date();
                return value >= start;
            },
            message: 'Ngày kết thúc phải sau ngày bắt đầu'
        }
    },
    basePrice: {
        type: Number,
        required: [true, 'Giá gốc là bắt buộc']
    },
    discount: {
        type: Number,
        default: 0,
        min: [0, 'Giảm giá không được âm'],
        validate: {
            validator: function(value) {
                return value <= this.basePrice;
            },
            message: 'Giảm giá không được vượt quá giá gốc'
        }
    },
    vat: {
        type: Number,
        default: 10, // 10% VAT
        min: [0, 'Thuế không được âm']
    },
    totalAmount: {
        type: Number,
        required: [true, 'Tổng tiền là bắt buộc']
    },
    netAmount: {
        type: Number
    },
    ptCommission: {
        type: Number,
        default: 0
    },
    totalSessions: {
        type: Number,
        default: 0
    },
    remainingSessions: {
        type: Number,
        default: 0
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: [0, 'Số tiền đã trả không được âm']
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Deposit', 'Unpaid', 'Pending_Paid'],
        default: 'Unpaid'
    },
    paymentDeadline: {
        type: Date
    },
    contractStatus: {
        type: String,
        enum: ['Draft', 'Active', 'Expired', 'Paused', 'Cancelled', 'Liquidated'],
        default: 'Draft'
    },
    isFrozen: {
        type: Boolean,
        default: false
    },
    frozenAt: {
        type: Date
    },
    freezeFee: {
        type: Number,
        default: 200000 // 200k/tháng
    },
    freezeDuration: {
        type: Number,
        default: 0,
        max: [12, 'Thời gian bảo lưu tối đa là 12 tháng']
    },
    originalEndDate: {
        type: Date
    },
    currentEndDate: {
        type: Date
    },
    pauseHistory: [{
        startDate: Date,
        endDate: Date,
        reason: String,
        duration: Number
    }],
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Transfer', 'Card', 'Installment', 'Others'],
        default: 'Cash'
    },
    paymentMethods: [{
        type: String,
        enum: ['Cash', 'Transfer', 'Card', 'Installment']
    }],
    notes: String,
    /** Nguồn thu — báo cáo tài chính Sprint 3 */
    revenueSource: {
        type: String,
        enum: ['PT_Contract', 'Other'],
        default: 'Other'
    },
    googleDriveFileId: String,
    coupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    deleted: {
        type: Boolean,
        default: false,
        select: false
    }
}, { timestamps: true });

// Auto-generate contractCode using FMS-YYYY-MM-XXXX format
// Virtual to calculate current accumulated freeze fee
contractSchema.virtual('calculatedFreezeFee').get(function() {
    if (!this.isFrozen || !this.frozenAt) return 0;
    
    const now = new Date();
    const diffTime = Math.abs(now - this.frozenAt);
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    
    return diffMonths * (this.freezeFee || 200000);
});

contractSchema.set('toJSON', { virtuals: true });
contractSchema.set('toObject', { virtuals: true });

contractSchema.pre('save', async function(next) {
    if (!this.contractCode) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        // Find the last contract created in this month
        const lastContract = await this.constructor.findOne(
            { contractCode: new RegExp(`^FMS-${year}-${month}-`) },
            { contractCode: 1 }
        ).sort({ contractCode: -1 });

        let sequenceNumber = 1;
        if (lastContract && lastContract.contractCode) {
            const parts = lastContract.contractCode.split('-');
            sequenceNumber = parseInt(parts[3], 10) + 1;
        }

        const formattedSequence = String(sequenceNumber).padStart(4, '0');
        this.contractCode = `FMS-${year}-${month}-${formattedSequence}`;
    }
    
    // Set EndDates initially if they are not set. Note: Validation ensures endDate exists.
    if (this.isModified('endDate') && !this.originalEndDate) {
        this.originalEndDate = this.endDate;
        this.currentEndDate = this.endDate;
    }

    // Tự động đặt hạn chót thanh toán là 15 ngày kể từ ngày bắt đầu (nếu chưa có)
    if (!this.paymentDeadline) {
        const deadline = new Date(this.startDate || Date.now());
        deadline.setDate(deadline.getDate() + 15);
        this.paymentDeadline = deadline;
    }
});

// Audit DB (2/7): index cho query nóng — KPI, payroll, dashboard lọc theo pt/sales/client + trạng thái + thời gian
contractSchema.index({ pt: 1, paymentStatus: 1, startDate: -1 });
contractSchema.index({ sales: 1, paymentStatus: 1, startDate: -1 });
contractSchema.index({ client: 1 });
contractSchema.index({ branch: 1, contractStatus: 1 });
contractSchema.index({ contractStatus: 1, startDate: -1 });

module.exports = mongoose.model('Contract', contractSchema);
