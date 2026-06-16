const mongoose = require('mongoose');

const ptAvailabilitySlotSchema = new mongoose.Schema(
    {
        pt: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
        startTime: { type: Date, required: true },
        durationMinutes: { type: Number, default: 60 },
        status: {
            type: String,
            enum: ['Open', 'Pending', 'Booked', 'Cancelled'],
            default: 'Open'
        },
        pending: {
            client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            type: { type: String, enum: ['Book', 'Reschedule', 'Cancel'], default: 'Book' },
            requestedAt: { type: Date, default: null },
            note: { type: String, default: '' }
        }
    },
    {
        timestamps: true,
        collection: 'ptavailabilityslots'
    }
);

module.exports = mongoose.model('PtAvailabilitySlot', ptAvailabilitySlotSchema);
