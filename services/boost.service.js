// --- START OF FILE atu-mining-backend/services/boost.service.js ---

const mongoose = require('mongoose');
const User = require('../models/User.js');
const ActiveBoost = require('../models/ActiveBoost.js');
const Transaction = require('../models/Transaction.js');
const BOOSTS_CONFIG = require('../config/boosts.js');
const TASKS_CONFIG = require('../config/tasks.js');

/**
 * Asigna uno o más boosts a un usuario y maneja las recompensas/comisiones asociadas.
 * Esta función está diseñada para ser llamada desde una transacción de Mongoose existente.
 *
 * @param {object} options
 * @param {string} options.userId - El ObjectId del usuario.
 * @param {string} options.boostId - El ID del boost a comprar (ej: 'boost_lvl_1').
 * @param {number} options.quantity - La cantidad de boosts a comprar.
 * @param {mongoose.ClientSession} options.session - La sesión de Mongoose para la transacción.
 * @param {string} [options.purchaseMethod='crypto'] - 'crypto' o 'balance'.
 * @param {number} [options.totalCost=0] - El costo total si se paga con saldo.
 * @returns {Promise<void>}
 */
async function grantBoostsToUser({ userId, boostId, quantity, session, purchaseMethod = 'crypto', totalCost = 0 }) {
    
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error(`Usuario no encontrado para la asignación de boost: ${userId}`);
    
    const boostToBuy = BOOSTS_CONFIG.find(b => b.id === boostId);
    if (!boostToBuy) throw new Error(`Configuración de boost no encontrada: ${boostId}`);
    
    // --- LÓGICA DE LA MISIÓN "PRIMER BOOST" ---
    const firstBoostTask = TASKS_CONFIG.find(t => t.type === 'first_boost');
    if (firstBoostTask && !user.completedTasks.includes(String(firstBoostTask.id))) {
        user.autBalance += firstBoostTask.reward;
        user.completedTasks.push(String(firstBoostTask.id));
        
        await Transaction.create([{
            userId: user._id,
            type: 'claim_task',
            currency: 'AUT',
            amount: firstBoostTask.reward,
            status: 'completed',
            details: `Recompensa por tarea: ${firstBoostTask.title}`
        }], { session });
    }

    // Si se paga con saldo, se resta del balance
    if (purchaseMethod === 'balance') {
        if (user.usdtBalance < totalCost) throw new Error('Saldo insuficiente para la compra.');
        user.usdtBalance -= totalCost;
    }

    // --- ASIGNACIÓN DE BOOSTS ---
    const boostsToCreate = [];
    const expirationDate = new Date(Date.now() + boostToBuy.duration * 24 * 60 * 60 * 1000);

    for (let i = 0; i < quantity; i++) {
        boostsToCreate.push({
            userId: user._id,
            boostId: boostToBuy.id,
            yieldIncreasePerHour: boostToBuy.yieldIncrease,
            expiresAt: expirationDate,
        });
    }

    const createdBoosts = await ActiveBoost.insertMany(boostsToCreate, { session });
    
    user.activeBoosts.push(...createdBoosts.map(b => b._id));
    user.boostYieldPerHour = (user.boostYieldPerHour || 0) + (boostToBuy.yieldIncrease * quantity);

    await user.save({ session });
}

module.exports = { grantBoostsToUser };

// --- END OF FILE atu-mining-backend/services/boost.service.js ---