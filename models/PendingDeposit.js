// En: atu-mining-backend/models/PendingDeposit.js
const mongoose = require('mongoose');

const pendingDepositSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  amount: { type: Number, required: true },
  txHash: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('PendingDeposit', pendingDepositSchema);
