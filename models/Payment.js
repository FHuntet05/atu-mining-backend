const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    // El 'userId' es la única referencia que necesitamos al usuario.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    baseAmount: {
        type: Number,
        required: true,
    },
    uniqueAmount: {
        type: Number,
        required: true,
        unique: true, // Asegura que cada monto único sea, de hecho, único
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'expired'],
        default: 'pending',
    },
    txHash: { // Guardamos el hash de la transacción de BscScan para referencia
        type: String,
        default: null,
    },
    expiresAt: { // Para poder limpiar órdenes antiguas
        type: Date,
        required: true,
    },
    
    // --- INICIO DE CORRECCIÓN ---
    // Eliminamos los siguientes campos que estaban marcados como 'required'
    // pero que no estábamos proporcionando, causando el error de validación.
    /*
    boostId: {
        type: String, // O ObjectId si refieres a un modelo de Boost
        required: true, 
    },
    telegramId: {
        type: Number,
        required: true,
    }
    */
    // --- FIN DE CORRECCIÓN ---

}, { timestamps: true });

// Opcional: Crear un índice para que las órdenes que expiran se puedan limpiar eficientemente
paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;