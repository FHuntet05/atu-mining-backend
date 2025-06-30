// --- START OF FILE atu-mining-api/models/Payment.js (DEFINITIVO) ---

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderAddress: { type: String, required: true, lowercase: true, trim: true, index: true },
    
    boostId: { type: String, required: true },
    quantity: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending', index: true },
    txHash: { type: String, default: null },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Índice para que las órdenes que expiran se puedan limpiar eficientemente
paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

// --- END OF FILE atu-mining-api/models/Payment.js (DEFINITIVO) ---