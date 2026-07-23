const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: [true, 'Hợp đồng là bắt buộc']
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Khách hàng là bắt buộc']
    },
    amount: {
        type: Number,
        required: [true, 'Số tiền giao dịch là bắt buộc'],
        min: [0, 'Số tiền không được âm']
    },
    transactionType: {
        type: String,
        enum: ['Deposit', 'Full_Payment', 'Installment', 'Balance_Payment', 'Extension_Fee'],
        required: [true, 'Loại giao dịch là bắt buộc']
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Transfer', 'Card'],
        required: [true, 'Phương thức thanh toán là bắt buộc']
    },
    receiptNumber: {
        type: String,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['Success', 'Pending', 'Failed'],
        default: 'Pending'
    },
    notes: String,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Auto-generate receiptNumber using RCP-YYYY-MM-XXXX format
paymentTransactionSchema.pre('save', async function() {
    if (!this.receiptNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');

        // Find the last receipt created in this month
        const lastReceipt = await this.constructor.findOne(
            { receiptNumber: new RegExp(`^RCP-${year}-${month}-`) },
            { receiptNumber: 1 }
        ).sort({ receiptNumber: -1 });

        let sequenceNumber = 1;
        if (lastReceipt && lastReceipt.receiptNumber) {
            const parts = lastReceipt.receiptNumber.split('-');
            sequenceNumber = parseInt(parts[3], 10) + 1;
        }

        const formattedSequence = String(sequenceNumber).padStart(4, '0');
        this.receiptNumber = `RCP-${year}-${month}-${formattedSequence}`;
    }
});

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
