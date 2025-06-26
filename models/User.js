const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: false,
  },
  photoUrl: {
    type: String,
    required: false,
  },
  autBalance: {
    type: Number,
    default: 0,
  },
  usdtBalance: {
    type: Number,
    default: 0,
  },
  usdtForWithdrawal: {
    type: Number,
    default: 0,
  },
  lastClaim: {
    type: Date,
    default: Date.now,
  },
  boostYieldPerHour: {
    type: Number,
    default: 350 / 24, // Producción base inicial (ej: 350 AUT por día)
  },
  storageCapacity: {
    type: Number,
    default: (350 / 24) * 8, // Capacidad para 8 horas de producción base
  },
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  activeReferrals: {
    type: Number,
    default: 0,
  },
  lastWithdrawalRequest: {
    type: Date,
    default: null,
  },
  // --- INICIO DE MODIFICACIÓN: Añadir sección de misiones ---
  missions: {
    joinedGroup: { type: Boolean, default: false },
    firstBoostPurchased: { type: Boolean, default: false },
    invitedUsersCount: { type: Number, default: 0 },
    claimedInviteReward: { type: Boolean, default: false } // Para asegurar que la recompensa de 10 invitados se da una sola vez
  }
  // --- FIN DE MODIFICACIÓN ---
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

module.exports = User;