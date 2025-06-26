// En atu-mining-backend/models/User.js
// CÓDIGO COMPLETO Y ACTUALIZADO

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, trim: true },
  firstName: { type: String }, // Guardaremos el nombre de pila
  photoUrl: { type: String },
  
  // Balances
  usdtBalance: { type: Number, default: 0 },
  autBalance: { type: Number, default: 0 },
  usdtForWithdrawal: { type: Number, default: 0 },
  
  // Estado de Minería y Boosts
  lastClaim: { type: Date, default: Date.now },
  boostYieldPerHour: { type: Number, default: 0 },
  
  // Referidos
  referrerId: { type: Number, default: null },
  referrals: [{ type: Number }], // Todos los que se unieron con su enlace
  activeReferrals: [{ type: Number }], // Solo los que han depositado
  
  // Tareas y Estadísticas
  completedTasks: [{ type: Number }],
  totalMinedAUT: { type: Number, default: 0 },

  // --- NUEVO CAMPO PARA RETIROS ---
  lastWithdrawalRequest: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
