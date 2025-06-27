const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    baseAmount: { type: Number, required: true }, // El monto real de la compra (ej. 3.00)
    
    // --- NUEVO CAMPO ---
    // Guardamos la dirección desde la que el usuario dice que va a pagar. Debe estar en minúsculas.
    senderAddress: { type: String, required: true, lowercase: true, trim: true },

    status: { type: String, enum: ['pending', 'completed', 'failed', 'expired'], default: 'pending' },
    txHash: { type: String, default: null },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;