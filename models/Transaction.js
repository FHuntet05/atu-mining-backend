// En: atu-mining-backend/models/Transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    telegramId: {
        type: Number,
        required: true,
        index: true, // Para buscar transacciones por usuario rápidamente
    },
    type: {
        type: String,
        required: true,
        enum: ['claim', 'purchase', 'exchange', 'withdrawal', 'deposit'], // Tipos de transacción permitidos
    },
    description: {
        type: String,
        required: true,
    },
    amount: {
        type: String, // Usamos String para poder guardar formatos como "+10,000 AUT" o "-5.00 USDT"
        required: true,
    },
}, { timestamps: true }); // 'createdAt' se usará como la fecha de la transacción

module.exports = mongoose.model('Transaction', transactionSchema);