const mongoose = require('mongoose');

const activeBoostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    boostId: { type: String, required: true }, // ej: 'basic_rig', 'advanced_gpu'
    yieldIncreasePerHour: { type: Number, required: true }, // El aumento que proporciona este boost específico
    expiresAt: { type: Date, required: true } // Fecha en la que este boost deja de funcionar
}, { timestamps: true });

// Índice para limpiar boosts expirados eficientemente en el futuro
activeBoostSchema.index({ expiresAt: 1 });

const ActiveBoost = mongoose.model('ActiveBoost', activeBoostSchema);
module.exports = ActiveBoost;