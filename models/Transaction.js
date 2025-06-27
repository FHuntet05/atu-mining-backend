const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['deposit', 'purchase', 'claim', 'exchange', 'withdrawal_request', 'withdrawal_approved', 'withdrawal_rejected'],
        required: true,
    },
    currency: {
        type: String,
        enum: ['USDT', 'AUT'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        required: true,
    },
    details: {
        type: String,
    },
    txHash: { // Para depósitos o retiros procesados
        type: String,
    }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;