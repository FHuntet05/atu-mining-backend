// En: atu-mining-backend/models/Transaction.js
const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, index: true },
    type: { type: String, required: true, enum: ['claim', 'purchase', 'exchange', 'withdrawal', 'deposit'] },
    description: { type: String, required: true },
    amount: { type: String, required: true },
}, { timestamps: true });
module.exports = mongoose.model('Transaction', transactionSchema);
