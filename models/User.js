// En: atu-mining-backend/models/User.js
// CÓDIGO COMPLETO Y ACTUALIZADO

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
  
  // Lógica de referidos actualizada
  referrerId: { type: Number, default: null },
  referrals: [{ type: Number }], // Todos los que se unen
  activeReferrals: [{ type: Number }], // Solo los que han depositado
  
  completedTasks: [{ type: Number }],
  
  // Nuevo campo para el enfriamiento de retiros
  lastWithdrawalRequest: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);