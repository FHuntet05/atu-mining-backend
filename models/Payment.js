// En: atu-mining-backend/models/Payment.js
const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, index: true },
    boostId: { type: String, required: true },
    // El monto base del producto (ej. 3.00)
    baseAmount: { type: Number, required: true },
    // El monto único que el usuario debe pagar (ej. 3.001234)
    uniqueAmount: { type: Number, required: true, unique: true, index: true },
    status: { type: String, enum: ['pending', 'completed', 'expired'], default: 'pending' },
}, { timestamps: true });
module.exports = mongoose.model('Payment', paymentSchema);