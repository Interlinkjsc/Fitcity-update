const mongoose = require('mongoose');

const affiliateRewardLogSchema = new mongoose.Schema(
    {
        referrer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        contract: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contract',
            required: true,
            unique: true
        },
        reward: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Reward'
        },
        level: {
            type: String,
            enum: ['F1'],
            default: 'F1'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AffiliateRewardLog', affiliateRewardLogSchema);
