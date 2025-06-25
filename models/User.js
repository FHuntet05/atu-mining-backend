// En: atu-mining-backend/models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // --- Datos de Telegram ---
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, trim: true },
  firstName: { type: String },
  photoUrl: { type: String },

  // --- Balances del Juego ---
  usdtBalance: { type: Number, default: 0 },
  autBalance: { type: Number, default: 0 },
  usdtForWithdrawal: { type: Number, default: 0 },

  // --- Datos de Minería ---
  lastClaim: { type: Date, default: Date.now },
  boostYieldPerHour: { type: Number, default: 0 },

  // --- Estadísticas y Referidos ---
  totalMinedAUT: { type: Number, default: 0 },
  totalWithdrawnUSDT: { type: Number, default: 0 },
  referrerId: { type: Number, default: null },
  referrals: [{ type: Number }],

  // --- Tareas ---
  completedTasks: [{ type: Number }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
