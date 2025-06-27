const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    // Referencia al usuario que inició el pago
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Monto base que el usuario quería depositar (ej: 3.00)
    baseAmount: {
        type: Number,
        required: true,
    },
    // Monto único y específico que el usuario debe enviar (ej: 3.001234)
    uniqueAmount: {
        type: Number,
        required: true,
        unique: true, // Asegura que no se generen dos órdenes con el mismo monto exacto
    },
    // Estado actual de la orden de pago
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'expired', 'manual_review'],
        default: 'pending',
        index: true,
    },
    // Hash de la transacción de la blockchain una vez confirmada
    txHash: {
        type: String,
        default: null,
    },
    // Fecha y hora en la que la orden de pago expira
    expiresAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true });

// Índice TTL (Time-To-Live): MongoDB limpiará automáticamente los documentos expirados.
// Opcional, pero muy recomendado para mantener la colección limpia.
// Lo configuramos para que se borren 1 segundo después de la fecha de expiración.
paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;