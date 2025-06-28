// --- START OF FILE atu-mining-backend/models/Payment.js ---

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderAddress: { type: String, required: true, lowercase: true, trim: true },
    
    // La orden ahora ES el boost que se quiere comprar
    boostId: { type: String, required: true },
    quantity: { type: Number, required: true },
    
    baseAmount: { type: Number, required: true }, // El monto total que se espera recibir (price * quantity)
    
    status: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending' },
    txHash: { type: String, default: null }, // El tx hash que completó esta orden
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Limpia órdenes expiradas
paymentSchema.index({ status: 1, senderAddress: 1 }); // Optimiza la búsqueda del vigilante

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;

// --- END OF FILE atu-mining-backend/models/Payment.js ---