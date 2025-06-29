const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['deposit', 'purchase', 'claim_mining', 'claim_task', 'exchange', 'withdrawal_request', 'withdrawal_approved', 'withdrawal_rejected',  'referral_commission' ],
        required: true,
    },
    currency: { type: String, enum: ['USDT', 'AUT'], required: true },
    // El amount ahora será siempre un número.
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        required: true,
    },
    // Details es más flexible que description.
    details: { type: String }, 
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;