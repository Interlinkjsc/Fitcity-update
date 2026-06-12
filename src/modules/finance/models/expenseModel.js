const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Chi nhánh là bắt buộc']
    },
    category: {
        type: String,
        required: [true, 'Loại chi phí là bắt buộc'],
        enum: {
            values: [
                'Rent',
                'Electricity',
                'Water',
                'Equipment',
                'Maintenance',
                'Marketing',
                'Supplies',
                'Other'
            ],
            message: '{VALUE} không phải là loại chi phí hợp lệ'
        }
    },
    amountBeforeVat: {
        type: Number,
        min: [0, 'Số tiền trước VAT không được âm']
    },
    vatRate: {
        type: Number,
        default: 10,
        min: 0,
        max: 100
    },
    vatAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        min: [0, 'Tổng tiền không được âm']
    },
    /** Giữ tương thích code/dashboard cũ — mirror của total */
    amount: {
        type: Number,
        min: [0, 'Số tiền không được âm']
    },
    taxDocumentType: {
        type: String,
        enum: ['OUTPUT_VAT', 'INPUT_VAT', 'PIT', 'SOCIAL_INSURANCE', 'OTHER'],
        default: 'INPUT_VAT'
    },
    date: {
        type: Date,
        default: Date.now
    },
    description: {
        type: String,
        trim: true
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    invoiceImage: {
        type: String
    },
    googleDriveFileId: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Approved'
    }
}, { timestamps: true });

expenseSchema.pre('validate', function syncAmountFields() {
    if (this.total == null && this.amount != null) {
        this.total = this.amount;
    }
    if (this.amountBeforeVat == null && this.total != null) {
        this.amountBeforeVat = this.total;
        this.vatAmount = this.vatAmount || 0;
    }
    if (this.total != null) {
        this.amount = this.total;
    }
});

module.exports = mongoose.model('Expense', expenseSchema);
