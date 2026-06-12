const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        unique: true,
        enum: ['Admin', 'CEO', 'Manager', 'PT', 'Accountant', 'Marketing', 'Sales', 'Client']
    },
    permissionIds: {
        type: [String],
        default: []
    },
    isCustom: {
        type: Boolean,
        default: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
