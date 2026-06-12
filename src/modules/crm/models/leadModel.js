const mongoose = require('mongoose');
const { encrypt, decrypt, hash } = require('../../../utils/encryption');

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên khách hàng là bắt buộc'],
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        set: encrypt,
        get: decrypt
    },
    emailHash: {
        type: String,
        index: true
    },
    phone: {
        type: String,
        required: [true, 'Số điện thoại là bắt buộc'],
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
        required: [true, 'Phone hash is required for indexing'],
        index: true
    },
    interestedPackage: {
        type: String,
        enum: ['Gym', 'Yoga', 'PT', 'Kickfit', 'Pilates'],
        default: 'Gym'
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Chi nhánh quan tâm là bắt buộc']
    },
    source: {
        type: String,
        enum: ['Website', 'Contact', 'Facebook', 'Referral', 'Walk-in'],
        default: 'Website'
    },
    status: {
        type: String,
        enum: ['F', 'Contacted', 'Signed', 'Converted'],
        default: 'F'
    },
    /** Đường B (R2): User Client sau khi staff convert lead */
    convertedClientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    notes: String,
    // Initial Body Metrics for conversion comparison
    weight: Number,
    height: Number,
    bodyFat: Number,
    muscleMass: Number,
    targetGoal: {
        type: String,
        enum: ['Weight Loss', 'Muscle Gain', 'Maintenance', 'Endurance', 'Other']
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Sales rep
    }
}, { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Update Blind Indices BEFORE VALIDATION
leadSchema.pre('validate', async function() {
    if (this.isModified('email') && this.email) {
        this.emailHash = hash(this.email);
    }
    if (this.isModified('phone') && this.phone) {
        this.phoneHash = hash(this.phone);
    }
});

module.exports = mongoose.model('Lead', leadSchema);
