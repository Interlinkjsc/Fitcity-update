const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt, hash } = require('../../../utils/encryption');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Họ tên là bắt buộc'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email là bắt buộc'],
        trim: true,
        // Encryption: store encrypted, return decrypted
        set: encrypt,
        get: decrypt
    },
    emailHash: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    password: {
        type: String,
        required: [true, 'Mật khẩu là bắt buộc'],
        minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
        select: false
    },
    role: {
        type: String,
        enum: {
            values: ['SA', 'Admin', 'CEO', 'Manager', 'PT', 'Accountant', 'Marketing', 'Sales', 'Client'],
            message: '{VALUE} không phải là vai trò hợp lệ'
        },
        default: 'Client'
    },
    /** true = dùng customPermissionIds thay vì quyền mặc định của role */
    useCustomPermissions: {
        type: Boolean,
        default: false
    },
    customPermissionIds: {
        type: [String],
        default: []
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                const rawV = decrypt(v);
                return !rawV || /^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(rawV);
            },
            message: props => `${decrypt(props.value)} không phải là số điện thoại hợp lệ!`
        },
        set: encrypt,
        get: decrypt
    },
    phoneHash: {
        type: String,
        index: true
    },
    status: {
        type: String,
        enum: ['Active', 'Suspended', 'Resigned'],
        default: 'Active'
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    jobDescription: [{
        type: String
    }],
    avatar: {
        type: String,
        default: '/images/default-avatar.png'
    },
    // Affiliate / Referral System
    referralCode: {
        type: String,
        unique: true,
        sparse: true, // Only if set
        index: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Payroll & Commission Settings
    baseSalary: {
        type: Number,
        default: 5000000 // VND
    },
    /** % hoa hồng PT trên netAmount mỗi HĐ (lưu vào contract.ptCommission) */
    ptCommissionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    /** @deprecated Ưu tiên ptCommissionRate; giữ để tương thích dữ liệu cũ */
    ptCommissionPerSession: {
        type: Number,
        default: 150000
    },
    /** % hoa hồng Sales/Manager trên tổng netAmount HĐ Paid (payroll) */
    salesCommissionRate: {
        type: Number,
        default: 5,
        min: 0,
        max: 100
    },
    // Compliance & HR Documents (Google Drive IDs)
    cccdNumber: {
        type: String,
        set: encrypt,
        get: decrypt
    },
    cccdHash: {
        type: String,
        index: true
    },
    cccdIssueDate: {
        type: Date
    },
    cccdIssuePlace: {
        type: String
    },
    dob: {
        type: Date
    },
    address: {
        type: String
    },
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    bankInfo: {
        bankName: String,
        accountName: {
            type: String,
            set: encrypt,
            get: decrypt
        },
        accountNumber: {
            type: String,
            set: encrypt,
            get: decrypt,
            validate: {
                validator: function(v) {
                    if (!v) return true; // Optional field
                    const rawV = decrypt(v);
                    return !rawV || /^[0-9A-Z]{6,20}$/i.test(rawV);
                },
                message: 'Số tài khoản không hợp lệ (chỉ gồm chữ và số, độ dài 6-20 ký tự)'
            }
        }
    },
    taxDocumentId: {
        type: String
    },
    insuranceDocumentId: {
        type: String
    }
}, { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Update PII indices before validation
userSchema.pre('validate', async function() {
    if (this.isModified('email') && this.email) {
        this.emailHash = hash(this.email);
    }
    if (this.isModified('phone') && this.phone) {
        this.phoneHash = hash(this.phone);
    }
    if (this.isModified('cccdNumber') && this.cccdNumber) {
        this.cccdHash = hash(this.cccdNumber);
    }
});

// Hash password before saving + Generate Referral Code
userSchema.pre('save', async function() {
    // 1. Generate unique referralCode for Clients if not exists
    if (this.role === 'Client' && !this.referralCode) {
        let unique = false;
        while (!unique) {
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            const existing = await this.constructor.findOne({ referralCode: code });
            if (!existing) {
                this.referralCode = code;
                unique = true;
            }
        }
    }
    // 2. Hash Password
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
});

// Method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model('User', userSchema);
