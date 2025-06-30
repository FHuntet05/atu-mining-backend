// --- START OF FILE atu-mining-backend/models/AnomalousTransaction.js ---

const mongoose = require('mongoose');

const anomalousTransactionSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    username: { type: String, required: false },
    txHash: { type: String, required: true, unique: true, index: true },
    senderAddress: { type: String, required: true, lowercase: true, trim: true },
    amount: { type: Number, required: true }, // Monto en USDT (ya convertido)
    blockNumber: { type: String },
    timestamp: { type: Date }, // Fecha de la transacción en la blockchain
    status: {
        type: String,
        enum: ['pending_review', 'resolved', 'ignored'],
        default: 'pending_review'
    },
    // Quién lo resolvió y cuándo
    resolvedByAdminId: { type: Number, default: null }, 
    resolvedAt: { type: Date, default: null },

}, { timestamps: true }); // createdAt será la fecha de detección

const AnomalousTransaction = mongoose.model('AnomalousTransaction', anomalousTransactionSchema);
module.exports = AnomalousTransaction;

// --- END OF FILE atu-mining-backend/models/AnomalousTransaction.js ---