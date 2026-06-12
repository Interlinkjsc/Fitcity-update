const mongoose = require('mongoose');

const bodyMetricSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    weight: { type: Number, required: true }, // KG
    height: { type: Number }, // CM
    bodyFat: { type: Number }, // %
    muscleMass: { type: Number }, // KG
    visceralFat: { type: Number }, // Level
    water: { type: Number, default: 0 }, // %
    minerals: { type: Number, default: 0 }, // KG
    protein: { type: Number, default: 0 }, // %
    bmi: { type: Number },
    measurements: {
        chest: Number,
        waist: Number,
        hips: Number,
        bicep: Number,
        thigh: Number
    },
    notes: String
}, { timestamps: true });

// Auto-calculate BMI if height and weight exist
bodyMetricSchema.pre('save', async function() {
    if (this.weight && this.height) {
        const heightInMeters = this.height / 100;
        const calculatedBmi = this.weight / (heightInMeters * heightInMeters);
        this.bmi = Number(calculatedBmi.toFixed(1));
    }
});

module.exports = mongoose.model('BodyMetric', bodyMetricSchema);
