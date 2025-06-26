// En: atu-mining-backend/models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, index: true },
    boostId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    nowPaymentsId: { type: String }, // Guardaremos el ID de pago de NOWPayments
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);