// En: atu-mining-backend/models/User.js
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, trim: true },
  firstName: { type: String },
  photoUrl: { type: String },
  usdtBalance: { type: Number, default: 0 },
  autBalance: { type: Number, default: 0 },
  usdtForWithdrawal: { type: Number, default: 0 },
  lastClaim: { type: Date, default: Date.now },
  boostYieldPerHour: { type: Number, default: 0 },
  totalMinedAUT: { type: Number, default: 0 },
  
  referrerId: { type: Number, default: null }, // Guardamos el telegramId del referente
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Guardamos el _id del referido
  activeReferrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referralEarnings: { type: Number, default: 0 },
  
  completedTasks: [{ type: Number }],
  lastWithdrawalRequest: { type: Date, default: null },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);